'use client';

import { RiCloseLine, RiUploadCloud2Line } from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { hasCapability, type WorkspaceContext } from '@knowledge/domain';

import { AppIcon } from '@/components/ui/app-icon';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

import { performUploadBatch, type UploadProgress } from './browser-upload';

const PROGRESS_LABELS = {
  authorizing: '准备中',
  uploading: '上传中',
  verifying: '校验中',
  queued: '排队中',
} as const;

export function UploadDialog({
  context,
  workspaceName,
  onCompleted,
}: {
  context: WorkspaceContext;
  workspaceName: string;
  /**
   * Optional: a Server Component cannot pass a function across the boundary,
   * so the page omits it and the dialog refreshes the route itself.
   */
  onCompleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState('');

  // The database refuses an unauthorised upload regardless; hiding the control
  // is only so a viewer is not invited to try.
  if (!hasCapability(context.role, 'documents.upload')) {
    return <p className="text-sm text-[var(--muted)]">你在此工作区拥有只读权限。</p>;
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
        onClick={() => setOpen(true)}
      >
        <AppIcon icon={RiUploadCloud2Line} size="action" />
        上传资料
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4"
        >
          <section className="w-full max-w-lg rounded-[7px] bg-[var(--canvas)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="upload-title" className="text-lg font-semibold">
                上传到 {workspaceName}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭上传窗口"
                title="关闭上传窗口"
                onClick={() => setOpen(false)}
              >
                <AppIcon icon={RiCloseLine} />
              </button>
            </div>

            {context.kind === 'team' && (
              <p className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-sm">
                {workspaceName} 的所有成员都能看到这些资料。
              </p>
            )}

            <label className="mt-5 block text-sm font-medium" htmlFor="upload-files">
              选择资料
            </label>
            <input
              id="upload-files"
              aria-label="选择资料"
              className="mt-2 min-h-11 w-full"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.md,.txt"
              onChange={async (event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                if (!files.length) return;
                setError('');
                try {
                  const supabase = createBrowserSupabaseClient();
                  await performUploadBatch({
                    workspaceId: context.workspaceId,
                    files,
                    gateway: {
                      async upload(session, file) {
                        const { error: uploadError } = await supabase.storage
                          .from('originals')
                          .uploadToSignedUrl(session.objectPath, session.uploadToken, file, {
                            contentType: file.type,
                            upsert: false,
                          });
                        if (uploadError) throw uploadError;
                      },
                    },
                    onProgress(next) {
                      setProgress((current) => [
                        ...current.filter((item) => item.fileName !== next.fileName),
                        next,
                      ]);
                    },
                  });
                  onCompleted?.();
                  // Close deliberately. Refreshing swaps the library between
                  // its empty state and its list, which remounts this dialog
                  // anyway; doing it explicitly keeps the behaviour defined.
                  setOpen(false);
                  router.refresh();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : '上传失败，请更换文件后重试');
                }
              }}
            />

            <ul aria-live="polite" className="mt-4 space-y-1 text-sm">
              {progress.map((item) => (
                <li key={item.fileName}>
                  {item.fileName}：
                  {item.state === 'failed'
                    ? (item.message ?? '失败')
                    : PROGRESS_LABELS[item.state]}
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

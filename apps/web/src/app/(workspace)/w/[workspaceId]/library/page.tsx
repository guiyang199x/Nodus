import { EmptyState } from '@/components/ui/empty-state';
import { DocumentList } from '@/features/uploads/document-list';
import { listWorkspaceDocuments } from '@/features/uploads/queries';
import { UploadDialog } from '@/features/uploads/upload-dialog';
import { listAccessibleWorkspaces } from '@/features/workspaces/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceOr404 } from '@/lib/workspaces/require-or-404';

export const metadata = { title: '资料库' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceOr404(client, workspaceId, 'documents.read');
  const [documents, workspaces] = await Promise.all([
    listWorkspaceDocuments(client, workspaceId),
    listAccessibleWorkspaces(client),
  ]);
  const workspaceName =
    workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '当前工作区';

  return (
    <div className="page-content">
      {documents.length ? (
        <>
          <div className="mb-5 flex justify-end">
            <UploadDialog context={context} workspaceName={workspaceName} />
          </div>
          <DocumentList documents={documents} />
        </>
      ) : (
        <EmptyState
          imageSrc="/illustrations/first-upload.png"
          imageAlt="人物把第一份资料放入档案盒"
          title="放入第一份资料"
          description="支持图片、PDF、DOCX、Markdown 和 TXT。原件保存后，你可以离开页面，处理会继续进行。"
          action={
            <UploadDialog context={context} workspaceName={workspaceName} />
          }
        />
      )}
    </div>
  );
}

import { RiUploadCloud2Line } from '@remixicon/react';

import { AppIcon } from '@/components/ui/app-icon';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: '资料库' };

export default function LibraryPage() {
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/first-upload.png"
        imageAlt="人物把第一份资料放入档案盒"
        title="放入第一份资料"
        description="支持图片、PDF、DOCX、Markdown 和 TXT。原件保存后，你可以离开页面，处理会继续进行。"
        action={
          <button
            type="button"
            data-open-upload
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
          >
            <AppIcon icon={RiUploadCloud2Line} size="action" />
            上传资料
          </button>
        }
      />
    </div>
  );
}

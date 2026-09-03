import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: '知识图谱' };

export default async function GraphPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  // Built from params rather than a relative href: from /w/<id>/graph a
  // "../library" href resolves to /w/library, which is not a route.
  const { workspaceId } = await params;
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/knowledge-graph.png"
        imageAlt="成员协作连接资料节点"
        title="连接会从资料中出现"
        description="完成处理后，有原文证据的资料、主题、人物和概念会在这里形成连接。"
        action={
          <Link
            href={`/w/${workspaceId}/library`}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--line)] px-4 transition-colors duration-150 hover:bg-[var(--hover)]"
          >
            返回资料库
          </Link>
        }
      />
    </div>
  );
}

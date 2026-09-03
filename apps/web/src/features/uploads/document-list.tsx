const STATUS_LABELS: Record<string, string> = {
  UPLOADING: '上传中',
  QUEUED: '排队中',
  VALIDATING: '校验中',
  EXTRACTING: '解析中',
  CHUNKING: '切分中',
  ANALYZING: '分析中',
  INDEXING: '建索引',
  READY: '就绪',
  RETRYING: '重试中',
  FAILED: '失败',
  CANCELLED: '已取消',
  SUPERSEDED: '已被替换',
};

export function DocumentList({
  documents,
}: {
  documents: Array<{ id: string; title: string; status: string; updated_at: string }>;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">资料库</h1>
      <div role="table" aria-label="资料列表" className="mt-8 border-t border-[var(--line)]">
        {documents.map((document) => (
          <div
            role="row"
            key={document.id}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_120px] items-center border-b border-[var(--line)]"
          >
            <span role="cell" className="truncate">
              {document.title}
            </span>
            <span role="cell" className="text-sm text-[var(--muted)]">
              {STATUS_LABELS[document.status] ?? document.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

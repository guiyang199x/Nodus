export const metadata = { title: '团队问答' };

export default function PublishedQaPage() {
  return (
    <div className="page-content">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">团队问答</h1>
      <div className="mt-12 border-y border-[var(--line)] py-10">
        <h2 className="text-lg font-medium">还没有已发布问答</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
          只有成员从私密对话中明确整理并发布的答案才会出现在这里；原始私聊不会公开给团队。
        </p>
      </div>
    </div>
  );
}

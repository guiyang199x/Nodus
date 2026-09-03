import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: '私密对话' };

export default function ChatPage() {
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/grounded-chat.png"
        imageAlt="人物基于多份来源资料提问"
        title="从你的资料开始提问"
        description="对话默认私密；即使使用团队资料，团队管理员也不能读取你的会话。"
        action={
          <button
            type="button"
            disabled
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-[var(--muted)]"
          >
            资料处理完成后可提问
          </button>
        }
      />
    </div>
  );
}

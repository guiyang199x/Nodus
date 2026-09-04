import Link from 'next/link';

export const metadata = { title: '找不到页面' };

/**
 * Reached both by a genuinely missing route and by requireWorkspaceOr404 when
 * the database refuses access. The wording deliberately covers both, so the
 * page never reveals whether the workspace exists.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] p-6">
      <section className="w-full max-w-md text-center">
        <p className="text-sm font-medium tracking-[0.08em] text-[var(--muted)]">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">找不到这个页面</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          链接可能已经失效，或者你没有访问这个工作区的权限。
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
        >
          回到工作台
        </Link>
      </section>
    </main>
  );
}

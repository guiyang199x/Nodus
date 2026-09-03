import { LoginForm } from '@/features/auth/login-form';

function safeNext(value: string | string[] | undefined) {
  const next = typeof value === 'string' ? value : '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] p-6">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <h1 id="login-title" className="text-3xl font-semibold tracking-[-0.03em]">
          进入知识工作台
        </h1>
        <p className="mb-7 mt-2 text-sm text-[var(--muted)]">使用邮箱验证码或 Google 登录。</p>
        <LoginForm next={safeNext(query.next)} />
        {query.error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            登录未完成，请重试。
          </p>
        )}
      </section>
    </main>
  );
}

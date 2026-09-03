import { BrandMark } from '@/features/auth/brand-mark';
import { LOGIN_COPY } from '@/features/auth/login-copy';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { KnowledgeConstellation } from '@/features/auth/knowledge-constellation';
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
  const next = safeNext(query.next);

  return (
    <main className="login-shell min-h-dvh bg-[var(--canvas)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col md:flex-row">
        {/* Sign-in column: ~42% at desktop, ~48% at tablet, full width on phones. */}
        <div className="flex w-full flex-col px-6 pb-10 pt-8 md:w-[52%] md:px-6 md:pb-12 md:pt-10 lg:w-[42%] lg:px-12 lg:pt-[48px] lg:pl-[48px]">
          <BrandMark className="enter-rise" />

          <div className="flex flex-1 flex-col justify-center py-10 md:py-0">
            {/* 400 px at desktop, 340-380 px at tablet, and centred in the
                column rather than flush with the brand mark. */}
            <div className="w-full max-w-[400px] md:mx-auto md:max-w-[380px] md:min-w-[340px] lg:max-w-[400px]">
              <h1
                className="enter-rise text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--ink)] md:text-[40px] xl:text-[46px]"
                style={{ ['--enter-delay' as string]: '60ms' }}
              >
                {LOGIN_COPY.headline}
              </h1>
              <p
                className="enter-rise mt-3 text-[15px] leading-6 text-[var(--muted)] md:text-[16px]"
                style={{ ['--enter-delay' as string]: '100ms' }}
              >
                {LOGIN_COPY.description}
              </p>

              <div
                className="enter-rise mt-8"
                style={{ ['--enter-delay' as string]: '140ms' }}
              >
                <LoginForm next={next} />

                <div className="my-5 flex items-center gap-4" aria-hidden="true">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-[13px] text-[var(--muted)]">{LOGIN_COPY.divider}</span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>

                <GoogleSignInButton next={next} />

                <p className="mt-5 text-[13px] leading-5 text-[var(--muted)]">
                  {LOGIN_COPY.privacyPrefix}
                  <a
                    href="/legal/terms"
                    className="text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {LOGIN_COPY.termsLink}
                  </a>
                  {LOGIN_COPY.privacyConjunction}
                  <a
                    href="/legal/privacy"
                    className="text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {LOGIN_COPY.privacyLink}
                  </a>
                  {LOGIN_COPY.privacySuffix}
                </p>

                {query.error && (
                  <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
                    登录未完成，请重试。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scene column. Decoration only, and it never overlaps the controls. */}
        <div className="pointer-events-none relative h-[180px] w-full shrink-0 overflow-hidden opacity-60 md:h-auto md:w-[48%] md:opacity-100 lg:w-[58%]">
          {/* Below 768 px the scene is a background band, so it is scaled up
              and cropped instead of shrinking the whole diagram to fit. */}
          <div className="absolute inset-0 scale-[2.1] md:static md:h-full md:scale-100 md:py-8 md:pr-4 lg:py-10 lg:pr-6">
            <KnowledgeConstellation />
          </div>
        </div>
      </div>
    </main>
  );
}

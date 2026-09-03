import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Same-origin paths only; an absolute or protocol-relative target is dropped. */
function safeNextPath(value: string | null): string {
  const next = value ?? '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/**
 * Redirects here are relative on purpose.
 *
 * Both `request.url` and `request.nextUrl` report the server's own origin
 * rather than the host the browser used - in dev that is `localhost` even for
 * a request to `127.0.0.1`. An absolute redirect would therefore move the
 * browser to a different host than the one the session cookie was just written
 * for, and the session would appear to vanish. A relative Location keeps the
 * browser wherever it already is, and avoids trusting a client-supplied Host
 * header to rebuild an absolute URL.
 */
function redirectTo(target: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: target } });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return redirectTo('/login?error=missing_code');

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return redirectTo('/login?error=session_exchange');

  return redirectTo(safeNextPath(request.nextUrl.searchParams.get('next')));
}

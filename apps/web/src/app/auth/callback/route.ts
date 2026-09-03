import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/';
  const safeNext =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(
    new URL(error ? '/login?error=session_exchange' : safeNext, request.url)
  );
}

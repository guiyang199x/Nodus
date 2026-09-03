import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { createUploadSessions } from '@/features/uploads/service';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    // The admin client only ever signs a path the database just minted; it is
    // never handed a path that came from the request body.
    const admin = createAdminSupabaseClient();
    const sessions = await createUploadSessions(
      client,
      {
        async sign(objectPath) {
          const { data, error } = await admin.storage
            .from('originals')
            .createSignedUploadUrl(objectPath, { upsert: false });
          if (error || !data.token) throw new Error('storage signing failed');
          return { token: data.token };
        },
      },
      await request.json(),
      randomUUID()
    );
    return NextResponse.json({ sessions }, { headers: NO_STORE });
  } catch (error) {
    // A ZodError's message is a JSON dump of its issues. The schema already
    // carries a readable message per rule, so surface that instead of handing
    // the browser the validator's internals.
    const message =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? '上传请求无效')
        : error instanceof Error
          ? error.message
          : '上传请求无效';
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
  }
}

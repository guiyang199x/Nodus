import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { completeUploadSession } from '@/features/uploads/service';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const result = await completeUploadSession(
      await createServerSupabaseClient(),
      sessionId,
      randomUUID()
    );
    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: '上传对象校验失败' }, { status: 409, headers: NO_STORE });
  }
}

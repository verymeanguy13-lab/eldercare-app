import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params;
  const pathname = req.nextUrl.searchParams.get('pathname');

  if (!pathname) {
    return NextResponse.json({ error: 'Missing pathname' }, { status: 400 });
  }

  try {
    await requireCircleMember(circleId, 'viewer');
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  if (!pathname.startsWith(`posts/${circleId}/`)) {
    return NextResponse.json({ error: 'Invalid pathname' }, { status: 403 });
  }

  const result = await get(pathname, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (result?.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
    },
  });
}
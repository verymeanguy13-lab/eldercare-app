import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { queryAsMember } from '@/lib/db';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params;

  try {
    const memberId = await requireCircleMember(circleId, 'viewer');

    const posts = await queryAsMember(
      memberId,
      `SELECT p.id, p.text, p.photo_url, p.created_at, m.name as author_name
       FROM posts p
       JOIN members m ON m.id = p.author_member_id
       WHERE p.circle_id = $1
       ORDER BY p.created_at DESC`,
      [circleId]
    );

    return NextResponse.json({ posts });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params;

  try {
    const memberId = await requireCircleMember(circleId, 'viewer');

    const formData = await req.formData();
    const text = formData.get('text');
    const photo = formData.get('photo') as File | null;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Post text required' }, { status: 400 });
    }

    let photoPathname: string | null = null;
    if (photo && photo.size > 0) {
      const pathname = `posts/${circleId}/${Date.now()}-${photo.name}`;
      await put(pathname, photo, {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      photoPathname = pathname;
    }

    const created = await queryAsMember(
      memberId,
      `INSERT INTO posts (circle_id, author_member_id, text, photo_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, text, photo_url, created_at`,
      [circleId, memberId, text.trim(), photoPathname]
    );

    return NextResponse.json({ post: created[0] });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
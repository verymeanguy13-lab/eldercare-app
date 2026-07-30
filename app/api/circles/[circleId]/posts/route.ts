import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { queryAsMember } from '@/lib/db';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';
import { getPostsForCircle } from '@/lib/posts';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params;

  try {
    const memberId = await requireCircleMember(circleId, 'viewer');
    const posts = await getPostsForCircle(memberId, circleId);
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
    const requestedType = formData.get('postType');

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

    // The person's explicit choice always wins. 'photo' is only an
    // automatic classification for the DEFAULT case — attaching an
    // image without deliberately picking 小提醒 first.
    let postType: string = 'status_update';
    if (requestedType === 'note') {
      postType = 'note';
    } else if (photoPathname) {
      postType = 'photo';
    }

    await queryAsMember(
      memberId,
      `INSERT INTO posts (circle_id, author_member_id, text, photo_url, post_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [circleId, memberId, text.trim(), photoPathname, postType]
    );

    const posts = await getPostsForCircle(memberId, circleId);
    return NextResponse.json({ posts });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
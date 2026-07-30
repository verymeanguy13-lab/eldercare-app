import { NextRequest, NextResponse } from 'next/server';
import { queryAsMember } from '@/lib/db';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';
import { getPostsForCircle } from '@/lib/posts';

const ALLOWED_EMOJI = ['👍', '❤️', '🙏', '😊', '😢'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; postId: string }> }
) {
  const { circleId, postId } = await params;

  try {
    const memberId = await requireCircleMember(circleId, 'viewer');

    const { emoji } = await req.json();
    if (!ALLOWED_EMOJI.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
    }

    // Confirm the post genuinely belongs to this circle before touching
    // it — same defensive pattern as the photo-serving route in Session 4.
    const postCheck = await queryAsMember(
      memberId,
      `SELECT id FROM posts WHERE id = $1 AND circle_id = $2`,
      [postId, circleId]
    );
    if (!postCheck[0]) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const existing = await queryAsMember<{ id: string; emoji: string }>(
      memberId,
      `SELECT id, emoji FROM reactions WHERE post_id = $1 AND member_id = $2`,
      [postId, memberId]
    );

    if (existing[0] && existing[0].emoji === emoji) {
      await queryAsMember(memberId, `DELETE FROM reactions WHERE id = $1`, [
        existing[0].id,
      ]);
    } else if (existing[0]) {
      await queryAsMember(
        memberId,
        `UPDATE reactions SET emoji = $1 WHERE id = $2`,
        [emoji, existing[0].id]
      );
    } else {
      await queryAsMember(
        memberId,
        `INSERT INTO reactions (circle_id, post_id, member_id, emoji) VALUES ($1, $2, $3, $4)`,
        [circleId, postId, memberId, emoji]
      );
    }

    const posts = await getPostsForCircle(memberId, circleId);
    return NextResponse.json({ posts });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
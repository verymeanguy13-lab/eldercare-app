import { redirect } from 'next/navigation';
import { getCurrentMemberId } from '@/lib/current-member';
import { queryAsMember } from '@/lib/db';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';
import FeedClient from './feed-client';

export const dynamic = 'force-dynamic';

export default async function FeedPage({
  params,
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;

  const currentMemberId = await getCurrentMemberId();
  if (!currentMemberId) redirect('/login');

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

    return <FeedClient circleId={circleId} initialPosts={posts as any} />;
  } catch (e) {
    if (e instanceof AuthError) {
      redirect('/dashboard');
    }
    throw e;
  }
}
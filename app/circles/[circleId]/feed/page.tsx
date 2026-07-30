import { redirect } from 'next/navigation';
import { getCurrentMemberId } from '@/lib/current-member';
import { requireCircleMember, AuthError } from '@/lib/require-circle-member';
import { getPostsForCircle } from '@/lib/posts';
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
    const posts = await getPostsForCircle(memberId, circleId);
    return <FeedClient circleId={circleId} initialPosts={posts} />;
  } catch (e) {
    if (e instanceof AuthError) {
      redirect('/dashboard');
    }
    throw e;
  }
}
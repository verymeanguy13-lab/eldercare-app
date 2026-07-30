import { queryAsMember } from './db';

export type PostReaction = {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
};

export type PostWithReactions = {
  id: string;
  text: string | null;
  photo_url: string | null;
  post_type: string;
  created_at: string;
  author_name: string;
  reactions: PostReaction[];
};

/**
 * Fetches all posts for a circle, each with its reaction summary
 * (per-emoji counts, and whether the current member reacted with it).
 * Shared by both the feed page and the posts API route so their
 * behavior can never drift apart.
 */
export async function getPostsForCircle(
  memberId: string,
  circleId: string
): Promise<PostWithReactions[]> {
  const posts = await queryAsMember<any>(
    memberId,
    `SELECT p.id, p.text, p.photo_url, p.post_type, p.created_at, m.name as author_name
     FROM posts p
     JOIN members m ON m.id = p.author_member_id
     WHERE p.circle_id = $1
     ORDER BY p.created_at DESC`,
    [circleId]
  );

  if (posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const reactionRows = await queryAsMember<{
    post_id: string;
    emoji: string;
    count: number;
    reacted_by_me: boolean;
  }>(
    memberId,
    `SELECT post_id, emoji, COUNT(*)::int as count,
            bool_or(member_id = $2) as reacted_by_me
     FROM reactions
     WHERE post_id = ANY($1)
     GROUP BY post_id, emoji`,
    [postIds, memberId]
  );

  return posts.map((p: any) => ({
    ...p,
    reactions: reactionRows
      .filter((r) => r.post_id === p.id)
      .map((r) => ({
        emoji: r.emoji,
        count: Number(r.count),
        reacted_by_me: r.reacted_by_me,
      })),
  }));
}
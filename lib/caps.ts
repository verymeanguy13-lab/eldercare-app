import { queryUnsafe } from './db';

const FREE_TIER_MEMBER_CAP = 3;

export function isWithinMemberCap(
  tier: string,
  currentCount: number
): { allowed: boolean; reason?: string } {
  if (tier === 'paid') return { allowed: true };
  if (currentCount >= FREE_TIER_MEMBER_CAP) {
    return {
      allowed: false,
      reason: `免費方案最多 ${FREE_TIER_MEMBER_CAP} 位成員，升級即可新增更多家人。`,
    };
  }
  return { allowed: true };
}

/**
 * Cap-checking only — does NOT do access control. Callers must already
 * have confirmed the caller is allowed to know about this circleId
 * (via requireCircleMember, or a validated invite code) before calling.
 */
export async function checkMemberCap(
  circleId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const rows = await queryUnsafe<{ tier: string; member_count: string }>(
    `SELECT c.tier, COUNT(cm.id)::int as member_count
     FROM circles c
     LEFT JOIN circle_memberships cm ON cm.circle_id = c.id
     WHERE c.id = $1
     GROUP BY c.tier`,
    [circleId]
  );
  const row = rows[0];
  if (!row) return { allowed: false, reason: 'Circle not found' };
  return isWithinMemberCap(row.tier, Number(row.member_count));
}
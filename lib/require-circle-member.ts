import { queryAsMember } from './db';
import { getCurrentMemberId } from './current-member';

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  caregiver: 1,
  family_member: 2,
  admin: 3,
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function hasRequiredRole(
  actualRole: string,
  minRole: keyof typeof ROLE_RANK
): boolean {
  return ROLE_RANK[actualRole] >= ROLE_RANK[minRole];
}

/**
 * Confirms the signed-in member belongs to circleId with at least
 * minRole. Throws AuthError if not. Every future route touching
 * circle-scoped data should call this FIRST, then use
 * queryAsMember(memberId, ...) for the actual query.
 */
export async function requireCircleMember(
  circleId: string,
  minRole: keyof typeof ROLE_RANK = 'viewer'
): Promise<string> {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    throw new AuthError('Not signed in', 401);
  }

  const rows = await queryAsMember<{ role: string }>(
    memberId,
    `SELECT role FROM circle_memberships WHERE circle_id = $1 AND member_id = $2`,
    [circleId, memberId]
  );

  const membership = rows[0];
  if (!membership) {
    throw new AuthError('Not a member of this circle', 403);
  }

  if (!hasRequiredRole(membership.role, minRole)) {
    throw new AuthError(`Requires role ${minRole} or higher`, 403);
  }

  return memberId;
}
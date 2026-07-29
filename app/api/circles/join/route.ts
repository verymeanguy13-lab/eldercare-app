import { NextRequest, NextResponse } from 'next/server';
import { queryUnsafe } from '@/lib/db';
import { getCurrentMemberId } from '@/lib/current-member';
import { checkMemberCap } from '@/lib/caps';

export async function POST(req: NextRequest) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { inviteCode } = await req.json();
  if (!inviteCode || typeof inviteCode !== 'string') {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  // Deliberate RLS exception: the invite code itself is the credential
  // proving the right to join, so this runs at owner level.
  const circles = await queryUnsafe<{ id: string }>(
    `SELECT id FROM circles WHERE invite_code = $1`,
    [inviteCode.trim()]
  );
  const circle = circles[0];
  if (!circle) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  const existing = await queryUnsafe(
    `SELECT id FROM circle_memberships WHERE circle_id = $1 AND member_id = $2`,
    [circle.id, memberId]
  );
  if (existing[0]) {
    return NextResponse.json(
      { error: 'Already a member of this circle' },
      { status: 409 }
    );
  }

  const cap = await checkMemberCap(circle.id);
  if (!cap.allowed) {
    return NextResponse.json({ error: cap.reason }, { status: 403 });
  }

  await queryUnsafe(
    `INSERT INTO circle_memberships (circle_id, member_id, role) VALUES ($1, $2, 'family_member')`,
    [circle.id, memberId]
  );

  return NextResponse.json({ ok: true, circleId: circle.id });
}
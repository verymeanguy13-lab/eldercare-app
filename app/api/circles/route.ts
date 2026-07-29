import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { queryUnsafe } from '@/lib/db';
import { getCurrentMemberId } from '@/lib/current-member';

export async function POST(req: NextRequest) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Circle name required' }, { status: 400 });
  }

  const inviteCode = randomBytes(4).toString('hex');

  const circles = await queryUnsafe<{ id: string }>(
    `INSERT INTO circles (name, invite_code) VALUES ($1, $2) RETURNING id`,
    [name, inviteCode]
  );
  const circleId = circles[0].id;

  await queryUnsafe(
    `INSERT INTO circle_memberships (circle_id, member_id, role) VALUES ($1, $2, 'admin')`,
    [circleId, memberId]
  );

  return NextResponse.json({ circleId, inviteCode });
}
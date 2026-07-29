import { redirect } from 'next/navigation';
import { getCurrentMemberId } from '@/lib/current-member';
import { queryAsMember } from '@/lib/db';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const memberId = await getCurrentMemberId();
  if (!memberId) redirect('/login');

  const circles = await queryAsMember<{
    id: string;
    name: string;
    role: string;
    invite_code: string;
  }>(
    memberId,
    `SELECT c.id, c.name, cm.role, c.invite_code
     FROM circles c
     JOIN circle_memberships cm ON cm.circle_id = c.id
     WHERE cm.member_id = $1`,
    [memberId]
  );

  return <DashboardClient circles={circles} />;
}
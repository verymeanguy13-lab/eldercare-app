import { cookies } from 'next/headers';
import { getMemberIdFromSessionToken, SESSION_COOKIE_NAME } from './auth';

export async function getCurrentMemberId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getMemberIdFromSessionToken(token);
}
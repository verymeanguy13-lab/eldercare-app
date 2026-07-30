import { NextRequest, NextResponse } from 'next/server';
import {
  verifyMagicLinkToken,
  findOrCreateMemberByEmail,
  createSession,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url));
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(new URL('/login?error=invalid_or_expired', req.url));
  }

  const memberId = await findOrCreateMemberByEmail(email, email.split('@')[0]);
  const sessionToken = await createSession(memberId);

  const response = NextResponse.redirect(new URL('/dashboard', req.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
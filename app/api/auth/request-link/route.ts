import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createMagicLinkToken } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const token = await createMagicLinkToken(email);
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: 'Eldercare App <onboarding@resend.dev>',
    to: email,
    subject: '登入連結 / Your login link',
    html: `<p>點擊以下連結登入：</p><p><a href="${link}">${link}</a></p><p>此連結 15 分鐘內有效。</p>`,
  });

  return NextResponse.json({ ok: true });
}
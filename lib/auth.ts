import { randomBytes } from 'crypto';
import { queryUnsafe } from './db';

export const SESSION_COOKIE_NAME = 'session_token';
const SESSION_DURATION_DAYS = 30;
const MAGIC_LINK_DURATION_MINUTES = 15;

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createMagicLinkToken(email: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DURATION_MINUTES * 60 * 1000);
  await queryUnsafe(
    `INSERT INTO magic_link_tokens (token, email, expires_at) VALUES ($1, $2, $3)`,
    [token, email.toLowerCase().trim(), expiresAt]
  );
  return token;
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const rows = await queryUnsafe<{ email: string }>(
    `UPDATE magic_link_tokens
     SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email`,
    [token]
  );
  return rows[0]?.email ?? null;
}

export async function findOrCreateMemberByEmail(
  email: string,
  name: string
): Promise<string> {
  const existing = await queryUnsafe<{ id: string }>(
    `SELECT id FROM members WHERE email = $1`,
    [email]
  );
  if (existing[0]) return existing[0].id;

  const created = await queryUnsafe<{ id: string }>(
    `INSERT INTO members (email, name) VALUES ($1, $2) RETURNING id`,
    [email, name]
  );
  return created[0].id;
}

export async function createSession(memberId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await queryUnsafe(
    `INSERT INTO sessions (token, member_id, expires_at) VALUES ($1, $2, $3)`,
    [token, memberId, expiresAt]
  );
  return token;
}

export async function getMemberIdFromSessionToken(
  token: string
): Promise<string | null> {
  const rows = await queryUnsafe<{ member_id: string }>(
    `SELECT member_id FROM sessions WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  return rows[0]?.member_id ?? null;
}
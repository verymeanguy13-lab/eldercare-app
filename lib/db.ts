import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is not set');
}
if (!process.env.NEON_APP_USER_DATABASE_URL) {
  throw new Error('NEON_APP_USER_DATABASE_URL environment variable is not set');
}

// Owner-level connection: full access, BYPASSES Row-Level Security.
// Use ONLY for: auth flows before a member is identified (magic link
// verification, session lookup), invite-code redemption, and
// admin/migration work. NEVER use this for circle-scoped data once a
// member is known — use queryAsMember() so RLS actually protects it.
const ownerSql = neon(process.env.NEON_DATABASE_URL);

// app_user-level connection: RLS policies from Session 2.5 apply here.
const appUserSql = neon(process.env.NEON_APP_USER_DATABASE_URL);

export async function queryUnsafe<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const rows = await ownerSql.query(query, params);
  return rows as T[];
}

/**
 * Run a query AS a specific member, with Row-Level Security enforced.
 * Bundles "identify who's asking" and "run the query" into one
 * transaction, since Neon's HTTP driver treats every call as an
 * independent request and won't remember a SET between separate calls.
 */
export async function queryAsMember<T = any>(
  memberId: string,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const results = await appUserSql.transaction([
    appUserSql.query('SELECT set_config($1, $2, true)', [
      'app.current_member_id',
      memberId,
    ]),
    appUserSql.query(query, params),
  ]);
  return results[1] as T[];
}
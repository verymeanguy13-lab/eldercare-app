import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.NEON_DATABASE_URL);

/**
 * Run a parameterized SQL query against Neon Postgres.
 * Always pass user-provided values via `params` ($1, $2, ...) —
 * never concatenate them into the query string.
 *
 * Returns an array of rows directly (no .rows wrapper).
 */
export async function queryUnsafe<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const rows = await sql.query(query, params);
  return rows as T[];
}

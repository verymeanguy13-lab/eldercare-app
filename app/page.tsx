import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const envVar = process.env.NEON_DATABASE_URL;
  const info: string[] = [];

  info.push(`env var exists: ${envVar !== undefined}`);
  info.push(`env var length: ${envVar?.length ?? 'n/a'}`);
  info.push(`env var starts with: ${envVar ? JSON.stringify(envVar.slice(0, 12)) : 'n/a'}`);
  info.push(`env var ends with: ${envVar ? JSON.stringify(envVar.slice(-12)) : 'n/a'}`);

  let sqlInfo = 'not attempted';
  try {
    const sql = neon(envVar as string);
    sqlInfo = `typeof sql: ${typeof sql}, typeof sql.query: ${typeof sql.query}, keys: ${Object.keys(sql).join(',')}`;
  } catch (e) {
    sqlInfo = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  return (
    <main>
      <h1>Diagnostic</h1>
      <pre>{info.join('\n')}</pre>
      <pre>{sqlInfo}</pre>
    </main>
  );
}

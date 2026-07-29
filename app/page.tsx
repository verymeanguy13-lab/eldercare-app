import { queryUnsafe } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let dbTime: string | null = null;
  let error: string | null = null;

  try {
    const rows = await queryUnsafe<{ now: string }>('SELECT NOW()');
    dbTime = rows[0]?.now ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <main>
      <h1>Eldercare App — Wiring Check</h1>
      {error ? (
        <p style={{ color: 'crimson' }}>
          ❌ Database connection failed: {error}
        </p>
      ) : (
        <p style={{ color: 'green' }}>
          ✅ Connected to Neon. Server time: {dbTime}
        </p>
      )}
    </main>
  );
}

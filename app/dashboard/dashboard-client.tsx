'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Circle = { id: string; name: string; role: string; invite_code: string };

export default function DashboardClient({ circles }: { circles: Circle[] }) {
  const router = useRouter();
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: circleName }),
    });
    if (res.ok) {
      router.refresh();
      setCircleName('');
    } else {
      setError((await res.json()).error);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/circles/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    if (res.ok) {
      router.refresh();
      setInviteCode('');
    } else {
      setError((await res.json()).error);
    }
  }

  return (
    <main>
      <h1>我的家庭圈</h1>
      {circles.length === 0 && <p>您尚未加入任何家庭圈。</p>}
      <ul>
        {circles.map((c) => (
          <li key={c.id}>
            {c.name}（{c.role}）— 邀請碼: {c.invite_code}
          </li>
        ))}
      </ul>

      <h2>建立新的家庭圈</h2>
      <form onSubmit={handleCreate}>
        <input
          value={circleName}
          onChange={(e) => setCircleName(e.target.value)}
          placeholder="家庭圈名稱"
          required
        />
        <button type="submit">建立</button>
      </form>

      <h2>加入現有家庭圈</h2>
      <form onSubmit={handleJoin}>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="邀請碼"
          required
        />
        <button type="submit">加入</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}
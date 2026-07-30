'use client';
import { useState, FormEvent } from 'react';

type Post = {
  id: string;
  text: string;
  photo_url: string | null;
  created_at: string;
  author_name: string;
};

export default function FeedClient({
  circleId,
  initialPosts,
}: {
  circleId: string;
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const formData = new FormData();
    formData.append('text', text);
    if (photo) formData.append('photo', photo);

    const res = await fetch(`/api/circles/${circleId}/posts`, {
      method: 'POST',
      body: formData,
    });

    setSubmitting(false);

    if (res.ok) {
      const { post } = await res.json();
      setPosts([{ ...post, author_name: '您' }, ...posts]);
      setText('');
      setPhoto(null);
    } else {
      setError((await res.json()).error || '發生錯誤，請再試一次。');
    }
  }

  return (
    <main>
      <h1>家庭動態</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="分享今天的狀況..."
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? '發佈中...' : '發佈'}
        </button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <strong>{p.author_name}</strong>{' '}
            <span>{new Date(p.created_at).toLocaleString('zh-TW')}</span>
            <p>{p.text}</p>
            {p.photo_url && (
              <img
                src={`/api/circles/${circleId}/posts/photo?pathname=${encodeURIComponent(p.photo_url)}`}
                alt=""
                style={{ maxWidth: '300px' }}
              />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
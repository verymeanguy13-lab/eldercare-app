'use client';
import { useState, FormEvent } from 'react';

type Reaction = { emoji: string; count: number; reacted_by_me: boolean };
type Post = {
  id: string;
  text: string | null;
  photo_url: string | null;
  post_type: string;
  created_at: string;
  author_name: string;
  reactions: Reaction[];
};

const EMOJI_OPTIONS = ['👍', '❤️', '🙏', '😊', '😢'];

const POST_TYPE_STYLES: Record<string, React.CSSProperties> = {
  status_update: {},
  photo: {
    borderLeft: '3px solid #90caf9',
    paddingLeft: '10px',
  },
  note: {
    background: '#fff8e1',
    padding: '8px 12px',
    borderRadius: '6px',
    fontStyle: 'italic',
  },
  system: {
    background: '#fdecea',
    padding: '8px 12px',
    borderRadius: '6px',
    fontWeight: 'bold',
  },
};

function postTypeLabel(type: string): string {
  if (type === 'note') return '📌 小提醒';
  if (type === 'photo') return '📷 照片';
  if (type === 'system') return '⚠️ 系統通知';
  return '';
}

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
  const [postType, setPostType] = useState<'status_update' | 'note'>(
    'status_update'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const formData = new FormData();
    formData.append('text', text);
    formData.append('postType', postType);
    if (photo) formData.append('photo', photo);

    const res = await fetch(`/api/circles/${circleId}/posts`, {
      method: 'POST',
      body: formData,
    });

    setSubmitting(false);

    if (res.ok) {
      const { posts: refreshed } = await res.json();
      setPosts(refreshed);
      setText('');
      setPhoto(null);
      setPostType('status_update');
    } else {
      setError((await res.json()).error || '發生錯誤，請再試一次。');
    }
  }

  async function handleReact(postId: string, emoji: string) {
    const res = await fetch(
      `/api/circles/${circleId}/posts/${postId}/react`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      }
    );
    if (res.ok) {
      const { posts: refreshed } = await res.json();
      setPosts(refreshed);
    }
  }

  return (
    <main>
      <h1>家庭動態</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            <input
              type="radio"
              checked={postType === 'status_update'}
              onChange={() => setPostType('status_update')}
            />
            動態
          </label>
          <label style={{ marginLeft: '12px' }}>
            <input
              type="radio"
              checked={postType === 'note'}
              onChange={() => setPostType('note')}
            />
            小提醒
          </label>
        </div>
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
          <li key={p.id} style={{ marginBottom: '16px', ...POST_TYPE_STYLES[p.post_type] }}>
            {postTypeLabel(p.post_type) && (
              <div style={{ fontSize: '0.85em' }}>{postTypeLabel(p.post_type)}</div>
            )}
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

            <div style={{ marginTop: '6px' }}>
              {EMOJI_OPTIONS.map((emoji) => {
                const existing = p.reactions.find((r) => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(p.id, emoji)}
                    style={{
                      marginRight: '4px',
                      background: existing?.reacted_by_me ? '#d0ebff' : undefined,
                      border: '1px solid #ccc',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {emoji} {existing ? existing.count : ''}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Unable to sign in.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#059669',
              color: '#fff',
              fontWeight: 700,
              fontSize: 20,
              marginBottom: 16,
            }}
          >
            D
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Admin Portal
          </h1>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: '#64748b',
            }}
          >
            Sign in to manage extracted records.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'block',
              marginBottom: 18,
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                outline: 'none',
              }}
            />
          </label>

          <label
            style={{
              display: 'block',
              marginBottom: 18,
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Password
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
              }}
            />
          </label>

          {error && (
            <div
              style={{
                marginBottom: 18,
                padding: 12,
                borderRadius: 10,
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 16px',
              border: 0,
              borderRadius: 10,
              background: '#059669',
              color: '#fff',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

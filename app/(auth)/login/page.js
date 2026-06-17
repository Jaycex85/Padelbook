'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎾 PadelBook</div>
        <h1 className="auth-title">Connexion</h1>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            placeholder="vous@exemple.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Mot de passe</label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button onClick={handleLogin} disabled={loading} className="btn-submit">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        <p className="auth-footer">
          Pas encore de compte ?{' '}
          <Link href="/register" className="auth-link">Créer un compte</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg);
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 32px;
        }
        .auth-logo {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--green);
          margin-bottom: 24px;
          text-align: center;
        }
        .auth-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 24px;
          text-align: center;
        }
        .form-group { margin-bottom: 16px; }
        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--muted);
          margin-bottom: 6px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .form-input {
          width: 100%;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 11px 14px;
          color: var(--text);
          font-size: 15px;
          transition: border-color .15s;
          font-family: 'Inter', sans-serif;
        }
        .form-input:focus { outline: none; border-color: var(--green); }
        .form-input::placeholder { color: var(--muted); }
        .form-error {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.3);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--red);
          margin-bottom: 16px;
        }
        .btn-submit {
          width: 100%;
          background: var(--green);
          color: #0D1117;
          border: none;
          border-radius: 8px;
          padding: 13px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s;
          font-family: 'Syne', sans-serif;
          margin-bottom: 16px;
        }
        .btn-submit:hover { background: #86efac; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-footer { font-size: 13px; color: var(--muted); text-align: center; }
        .auth-link { color: var(--green); text-decoration: none; font-weight: 500; }
        .auth-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

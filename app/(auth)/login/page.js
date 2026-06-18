'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Hard redirect pour forcer le middleware à relire les cookies de session
    window.location.href = '/'
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '11px 14px',
    color: 'var(--text)',
    fontSize: '15px',
    fontFamily: "'Inter', sans-serif",
    transition: 'border-color .15s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px' }}>

        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--green)', marginBottom: '24px', textAlign: 'center' }}>
          🎾 PadelBook
        </div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>
          Connexion
        </h1>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email</label>
          <input
            type="email"
            style={inputStyle}
            placeholder="vous@exemple.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Mot de passe</label>
          <input
            type="password"
            style={inputStyle}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', background: 'var(--green)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Syne',sans-serif", opacity: loading ? 0.6 : 1, marginBottom: '16px' }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          Pas encore de compte ?{' '}
          <Link href="/register" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

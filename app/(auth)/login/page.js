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
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/'
  }

  const inp = {
    width: '100%', background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '10px', padding: '12px 14px',
    color: 'var(--text)', fontSize: '15px',
    outline: 'none', transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
            borderRadius: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '26px',
            margin: '0 auto 12px',
            boxShadow: '0 8px 32px var(--purple-glow)',
          }}>🎾</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '22px' }}>PadelBook</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '28px',
        }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '22px', textAlign: 'center' }}>
            Connexion
          </h1>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" style={inp} placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mot de passe</label>
            <input type="password" style={inp} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: '100%', border: 'none', borderRadius: '10px', padding: '13px',
            fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Syne',sans-serif",
            background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
            color: '#fff', opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 20px var(--purple-glow)',
            marginBottom: '16px',
          }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
            Pas de compte ?{' '}
            <Link href="/register" style={{ color: 'var(--purple-l)', textDecoration: 'none', fontWeight: 500 }}>
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

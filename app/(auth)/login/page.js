'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(redirect); router.refresh()
  }

  const inputStyle = { width: '100%', background: '#1C2333', border: '1px solid #30363D', borderRadius: '8px', padding: '11px 14px', color: '#E6EDF3', fontSize: '15px', fontFamily: "'Inter', sans-serif", outline: 'none', transition: 'border-color .15s' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0D1117' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.png" alt="Mayfair Padel Club" style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', marginBottom: '12px' }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '18px', fontWeight: 800, color: '#C084FC', letterSpacing: '2px' }}>MAYFAIR</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '11px', fontWeight: 600, color: '#8B949E', letterSpacing: '4px' }}>PADEL CLUB</div>
        </div>
        <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '16px', padding: '28px' }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '22px', textAlign: 'center' }}>Connexion</h1>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#8B949E', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email</label>
            <input type="email" style={inputStyle} placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#8B949E', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Mot de passe</label>
            <input type="password" style={inputStyle} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#F87171', marginBottom: '16px' }}>{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{ width: '100%', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif", opacity: loading ? 0.6 : 1, marginBottom: '14px' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <p style={{ fontSize: '13px', color: '#8B949E', textAlign: 'center' }}>
            Pas encore de compte ?{' '}
            <Link href="/register" style={{ color: '#C084FC', textDecoration: 'none', fontWeight: 500 }}>Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: '#8B949E' }}>Chargement...</div>}>
      <LoginForm />
    </Suspense>
  )
}

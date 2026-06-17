'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister() {
    if (!email || !password) { setError('Email et mot de passe requis.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    if (data.user && (firstName || lastName)) {
      await supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName })
        .eq('id', data.user.id)
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="success-icon">✓</div>
          <h2 className="auth-title">Compte créé !</h2>
          <p style={{color: 'var(--muted)', textAlign: 'center', marginBottom: '24px', fontSize: '14px'}}>
            Vérifiez votre email pour confirmer votre compte.
          </p>
          <Link href="/login" className="btn-submit" style={{display:'block', textAlign:'center', textDecoration:'none'}}>
            Aller à la connexion
          </Link>
        </div>
        <style jsx>{`
          .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
          .auth-card { width:100%; max-width:400px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:32px; }
          .success-icon { font-size:48px; text-align:center; color:var(--green); margin-bottom:16px; }
          .auth-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; margin-bottom:8px; text-align:center; }
          .btn-submit { background:var(--green); color:#0D1117; border:none; border-radius:8px; padding:13px; font-size:15px; font-weight:600; cursor:pointer; font-family:'Syne',sans-serif; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎾 PadelBook</div>
        <h1 className="auth-title">Créer un compte</h1>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input type="text" className="form-input" placeholder="Johan" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom</label>
            <input type="text" className="form-input" placeholder="Dupont" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Mot de passe</label>
          <input type="password" className="form-input" placeholder="Min. 6 caractères" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button onClick={handleRegister} disabled={loading} className="btn-submit">
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>

        <p className="auth-footer">
          Déjà un compte ?{' '}
          <Link href="/login" className="auth-link">Se connecter</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg); }
        .auth-card { width:100%; max-width:400px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:32px; }
        .auth-logo { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--green); margin-bottom:24px; text-align:center; }
        .auth-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; margin-bottom:24px; text-align:center; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-group { margin-bottom:16px; }
        .form-label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:6px; letter-spacing:0.3px; text-transform:uppercase; }
        .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:11px 14px; color:var(--text); font-size:15px; transition:border-color .15s; font-family:'Inter',sans-serif; }
        .form-input:focus { outline:none; border-color:var(--green); }
        .form-input::placeholder { color:var(--muted); }
        .form-error { background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.3); border-radius:8px; padding:10px 14px; font-size:13px; color:var(--red); margin-bottom:16px; }
        .btn-submit { width:100%; background:var(--green); color:#0D1117; border:none; border-radius:8px; padding:13px; font-size:15px; font-weight:600; cursor:pointer; transition:background .15s; font-family:'Syne',sans-serif; margin-bottom:16px; }
        .btn-submit:hover { background:#86efac; }
        .btn-submit:disabled { opacity:0.6; cursor:not-allowed; }
        .auth-footer { font-size:13px; color:var(--muted); text-align:center; }
        .auth-link { color:var(--green); text-decoration:none; font-weight:500; }
      `}</style>
    </div>
  )
}

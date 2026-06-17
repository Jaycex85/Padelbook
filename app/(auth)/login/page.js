'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div style={{ padding: '40px', color: '#E6EDF3', background: '#0D1117', minHeight: '100vh' }}>
      <h1 style={{ color: '#4ADE80', marginBottom: '24px' }}>Connexion</h1>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: '12px', padding: '10px', width: '300px', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', borderRadius: '8px' }} />
      <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '12px', padding: '10px', width: '300px', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', borderRadius: '8px' }} />
      {error && <p style={{ color: '#F87171', marginBottom: '12px' }}>{error}</p>}
      <button onClick={handleLogin} disabled={loading}
        style={{ padding: '10px 24px', background: '#4ADE80', color: '#0D1117', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </div>
  )
}

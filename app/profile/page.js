'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setForm({ first_name: p?.first_name || '', last_name: p?.last_name || '', phone: p?.phone || '' })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await supabase.from('profiles').update(form).eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter', sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Mon profil</h1>

      {/* Infos lecture seule */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(74,222,128,0.08)', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
          {(profile?.first_name || profile?.email || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 500 }}>{profile?.email}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(74,222,128,0.1)', color: 'var(--brand)', fontWeight: 500 }}>
              {profile?.role}
            </span>
            {profile?.discount_percent > 0 && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)', fontWeight: 500 }}>
                Remise {profile.discount_percent}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Solde wallet</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: 700, color: 'var(--brand)' }}>
            {(profile?.wallet_balance || 0).toFixed(2)} €
          </div>
        </div>
        <div style={{ fontSize: '28px' }}>💳</div>
      </div>

      {/* Formulaire */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Informations personnelles</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Prénom</label>
            <input style={fieldStyle} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Johan" />
          </div>
          <div>
            <label style={labelStyle}>Nom</label>
            <input style={fieldStyle} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Dupont" />
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Téléphone</label>
          <input style={fieldStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+32 4xx xxx xxx" />
        </div>
        {saved && (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--brand)', marginBottom: '14px' }}>
            ✓ Profil enregistré
          </div>
        )}
        <button onClick={handleSave} disabled={saving}
          style={{ background: 'var(--brand)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne', sans-serif", opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </div>

      <button onClick={handleLogout}
        style={{ width: '100%', background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--red)', borderRadius: '8px', padding: '11px', fontSize: '14px', cursor: 'pointer' }}>
        Se déconnecter
      </button>
    </div>
  )
}

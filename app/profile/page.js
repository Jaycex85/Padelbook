'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import NotificationSettings from '../../components/NotificationSettings'
import PlayerStats from '../../components/PlayerStats'
import WalletHistory from '../../components/WalletHistory'
import { useRouter } from 'next/navigation'
import { goToPaymentUrl } from '../../lib/paymentNav'
import { useLocale } from '../../lib/i18n/LocaleContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'

const MD_RANKS = ['MD50','MD100','MD200','MD300','MD400','MD500','MD700','MD1000']
const WD_RANKS = ['WD50','WD100','WD200','WD300','WD400','WD500']

function formatMoney(value) {
  const n = value || 0
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', gender: '', afp_ranking: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  const [showTopup, setShowTopup] = useState(false)
  const [topupAmount, setTopupAmount] = useState(20)
  const [topupLoading, setTopupLoading] = useState(false)
  const fileInputRef = useRef(null)
  const supabase = createClient()
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setForm({
        first_name: p?.first_name || '',
        last_name: p?.last_name || '',
        phone: p?.phone || '',
        gender: p?.gender || '',
        afp_ranking: p?.afp_ranking || '',
      })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const payload = { ...form }
    if (!payload.gender) payload.gender = null
    if (!payload.afp_ranking) payload.afp_ranking = null
    await supabase.from('profiles').update(payload).eq('id', profile.id)
    setProfile(p => ({ ...p, ...payload }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTopup() {
    if (!topupAmount || topupAmount <= 0) return
    setTopupLoading(true)
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_topup: true, amount: topupAmount, profile_id: profile.id }),
    })
    const payData = await res.json().catch(() => ({}))
    setTopupLoading(false)
    if (payData.payment_url) {
      goToPaymentUrl(router, payData.payment_url)
    } else {
      alert(payData.error || 'Impossible d\'initier la recharge pour le moment.')
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)

    if (!file.type.startsWith('image/')) { setAvatarError('Le fichier doit être une image.'); return }
    if (file.size > 3 * 1024 * 1024) { setAvatarError('Image trop lourde (max 3 Mo).'); return }

    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = profile.id + '/avatar.' + ext

    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { setAvatarError(uploadErr.message); setUploadingAvatar(false); return }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now() // cache-bust

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
    setProfile(p => ({ ...p, avatar_url: avatarUrl }))
    setUploadingAvatar(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter', sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }
  const rankOptions = form.gender === 'female' ? WD_RANKS : form.gender === 'male' ? MD_RANKS : []

  return (
    <div style={{ maxWidth: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700 }}>{t('nav.profile')}</h1>
        <LanguageSwitcher />
      </div>

      {/* Avatar + infos */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--brand)',
              background: profile?.avatar_url ? 'transparent' : 'var(--brand-dim)',
              overflow: 'hidden', cursor: 'pointer', padding: 0, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-light)' }}>
                {(profile?.first_name || profile?.email || '?')[0].toUpperCase()}
              </span>
            )}
            {uploadingAvatar && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff' }}>...</div>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--brand)', border: '2px solid var(--surface)', color: '#fff', fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
            ✎
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 500 }}>{profile?.email}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontWeight: 500 }}>
              {profile?.role === 'admin' ? 'Admin' : 'Joueur'}
            </span>
            {profile?.discount_percent > 0 && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)', fontWeight: 500 }}>
                Remise {profile.discount_percent}%
              </span>
            )}
            {profile?.afp_ranking && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(96,165,250,0.1)', color: '#93C5FD', fontWeight: 500 }}>
                {profile.afp_ranking}
              </span>
            )}
          </div>
        </div>
      </div>
      {avatarError && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>
          {avatarError}
        </div>
      )}

      {/* Wallet */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Solde wallet</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: 700, color: (profile?.wallet_balance || 0) < 0 ? 'var(--red)' : 'var(--brand-light)' }}>
              {formatMoney(profile?.wallet_balance)} €
            </div>
            {(profile?.wallet_balance || 0) < 0 && (
              <p style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px' }}>
                Solde négatif — rechargez avant de pouvoir réserver à nouveau.
              </p>
            )}
          </div>
          <button onClick={() => setShowTopup(v => !v)}
            style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
            Recharger
          </button>
        </div>

        {showTopup && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {[10, 20, 50, 100].map(v => (
                <button key={v} onClick={() => setTopupAmount(v)}
                  style={{ background: topupAmount === v ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (topupAmount === v ? 'var(--brand)' : 'var(--border)'), color: topupAmount === v ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  {v} €
                </button>
              ))}
              <input type="number" min="1" step="1" value={topupAmount} onChange={e => setTopupAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '90px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '13px' }} />
            </div>
            <button onClick={handleTopup} disabled={topupLoading || !topupAmount || topupAmount <= 0}
              style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (topupLoading || !topupAmount || topupAmount <= 0) ? 0.5 : 1 }}>
              {topupLoading ? 'Redirection...' : 'Recharger ' + (topupAmount || 0) + ' € par carte'}
            </button>
          </div>
        )}
      </div>

      <WalletHistory userId={profile?.id} />

      <PlayerStats userId={profile?.id} />

      {/* Adhésions et cotisations : licences, statuts compétiteur (padel/badminton) */}
      <Link href="/membership" style={{ display: 'block', textDecoration: 'none', marginBottom: '20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Adhésions et cotisations</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Licences AFP, badminton, statuts compétiteur InterClubs/InterEquipes</div>
          </div>
          <div style={{ fontSize: '20px', color: 'var(--muted)' }}>→</div>
        </div>
      </Link>

      {/* Formulaire infos perso */}
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

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Téléphone</label>
          <input style={fieldStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+32 4xx xxx xxx" />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Genre</label>
          <select style={fieldStyle} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value, afp_ranking: '' })}>
            <option value="">Non précisé</option>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Classement AFP</label>
          <select style={fieldStyle} value={form.afp_ranking} onChange={e => setForm({ ...form, afp_ranking: e.target.value })} disabled={!form.gender}>
            <option value="">{form.gender ? 'Non classé' : 'Sélectionnez un genre d\'abord'}</option>
            {rankOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {saved && (
          <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--brand-light)', marginBottom: '14px' }}>
            ✓ Profil enregistré
          </div>
        )}
        <button onClick={handleSave} disabled={saving}
          style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne', sans-serif", opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </div>

      <NotificationSettings />

      <button onClick={handleLogout}
        style={{ width: '100%', background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--red)', borderRadius: '8px', padding: '11px', fontSize: '14px', cursor: 'pointer' }}>
        Se déconnecter
      </button>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from '../../../lib/i18n/LocaleContext'
import LanguageSwitcher from '../../../components/LanguageSwitcher'

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    ranking: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocale()

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleRegister() {
    if (!form.email || !form.password) { setError(t('register.emailPasswordRequired')); return }
    if (form.password.length < 6) { setError(t('register.passwordTooShort')); return }
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    if (data.user) {
      const updates = {}
      if (form.firstName) updates.first_name = form.firstName
      if (form.lastName) updates.last_name = form.lastName
      if (form.phone) updates.phone = form.phone
      if (form.gender) updates.gender = form.gender
      if (form.ranking) updates.ranking = form.ranking

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', data.user.id)
      }
    }

    setSuccess(true)
    setLoading(false)
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
  }

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--muted)',
    marginBottom: '6px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', color: 'var(--brand)', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{t('register.successTitle')}</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
            {t('register.successMessage')}
          </p>
          <Link href="/login" style={{ display: 'block', background: 'var(--brand)', color: '#0D1117', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', fontFamily: "'Syne',sans-serif" }}>
            {t('register.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <LanguageSwitcher />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px' }}>

        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand)', marginBottom: '24px', textAlign: 'center' }}>
          🎾 PadelBook
        </div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>
          {t('register.title')}
        </h1>

        {/* Prénom + Nom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>{t('register.firstName')}</label>
            <input style={inputStyle} type="text" placeholder="Johan" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{t('register.lastName')}</label>
            <input style={inputStyle} type="text" placeholder="Dupont" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t('register.email')} *</label>
          <input style={inputStyle} type="email" placeholder="vous@exemple.com" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>

        {/* Mot de passe */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t('register.password')} *</label>
          <input style={inputStyle} type="password" placeholder={t('register.passwordHint')} value={form.password} onChange={e => set('password', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
        </div>

        {/* Téléphone */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t('register.phone')}</label>
          <input style={inputStyle} type="tel" placeholder="+32 470 00 00 00" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>

        {/* Genre + Classement */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>{t('register.gender')}</label>
            <select style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">{t('register.genderSelect')}</option>
              <option value="M">{t('register.genderMale')}</option>
              <option value="F">{t('register.genderFemale')}</option>
              <option value="other">{t('register.genderOther')}</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('register.ranking')}</label>
            <input style={inputStyle} type="text" placeholder={t('register.rankingPlaceholder')} value={form.ranking} onChange={e => set('ranking', e.target.value)} />
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button onClick={handleRegister} disabled={loading} style={{ width: '100%', background: 'var(--brand)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Syne',sans-serif", opacity: loading ? 0.6 : 1, marginBottom: '16px' }}>
          {loading ? t('register.submitting') : t('register.submit')}
        </button>

        <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          {t('register.alreadyAccount')}{' '}
          <Link href="/login" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>{t('register.login')}</Link>
        </p>
        </div>
      </div>
    </div>
  )
}

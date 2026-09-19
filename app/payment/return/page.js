'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useLocale } from '../../../lib/i18n/LocaleContext'

const DESTINATIONS = {
  booking: '/my-bookings',
  event: '/events',
  membership: '/membership',
  wallet_topup: '/profile',
}

function ReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ref = searchParams.get('ref')
  const [status, setStatus] = useState('checking') // checking | paid | pending | failed
  const [category, setCategory] = useState(null)
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    if (!ref) { setStatus('failed'); return }
    let cancelled = false
    let attempts = 0

    async function poll() {
      attempts += 1
      const { data } = await supabase.from('payments').select('status, category').eq('id', ref).single()
      if (cancelled) return
      if (data?.category) setCategory(data.category)

      if (data?.status === 'paid') {
        setStatus('paid')
        setTimeout(() => { if (!cancelled) router.push(DESTINATIONS[data.category] || '/') }, 1500)
        return
      }
      if (['failed', 'canceled', 'expired'].includes(data?.status)) {
        setStatus('failed')
        return
      }
      if (attempts >= 8) {
        // Le webhook Mollie peut mettre quelques secondes — au-delà de ~16s
        // on arrête d'insister et on laisse la personne naviguer elle-même.
        setStatus('pending')
        return
      }
      setTimeout(poll, 2000)
    }

    poll()
    return () => { cancelled = true }
  }, [ref])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        {status === 'checking' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{t('paymentReturn.checking')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('paymentReturn.checkingDesc')}</p>
          </>
        )}
        {status === 'paid' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand-light)', marginBottom: '8px' }}>{t('paymentReturn.paid')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('paymentReturn.redirecting')}</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{t('paymentReturn.stillPending')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>{t('paymentReturn.stillPendingDesc')}</p>
            <a href={DESTINATIONS[category] || '/'} style={{ display: 'inline-block', background: 'var(--brand)', color: '#fff', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', fontFamily: "'Syne',sans-serif" }}>
              {t('paymentReturn.goBack')}
            </a>
          </>
        )}
        {status === 'failed' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: 'var(--red)', marginBottom: '8px' }}>{t('paymentReturn.failed')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>{t('paymentReturn.failedDesc')}</p>
            <a href={DESTINATIONS[category] || '/'} style={{ display: 'inline-block', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', textDecoration: 'none' }}>
              {t('paymentReturn.goBack')}
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnContent />
    </Suspense>
  )
}

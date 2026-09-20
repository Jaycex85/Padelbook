'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'
import { useLocale } from '../lib/i18n/LocaleContext'

// Props :
//   amount        : montant dû (€)
//   onChooseCard  : () => void  — déclenche le flow PayConic existant
//   onChooseWallet: () => Promise<void> — débite le wallet et marque payé
//   onClose       : () => void
export default function PaymentMethodModal({ amount, onChooseCard, onChooseWallet, onClose }) {
  const [walletBalance, setWalletBalance] = useState(null)
  const [processing, setProcessing] = useState(null) // null | 'wallet' | 'card'
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
      setWalletBalance(data?.wallet_balance ?? 0)
    })()
  }, [])

  const walletSufficient = walletBalance !== null && walletBalance >= amount

  async function handleWallet() {
    setProcessing('wallet')
    await onChooseWallet()
    setProcessing(null)
  }

  async function handleCard() {
    setProcessing('card')
    // Pas de setProcessing(null) après : en cas de succès la page navigue vers
    // Mollie (composant démonté), et en cas d'échec on veut que le bouton
    // reste visiblement "en cours" jusqu'à ce que l'appelant affiche son
    // propre message d'erreur — mieux vaut ça qu'un flash de retour à l'état normal.
    await onChooseCard()
    setProcessing(null)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '340px' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{t('payment.modalTitle')}</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>{t('payment.amountDue')} : <strong style={{ color: 'var(--brand-light)' }}>{amount.toFixed(2)} €</strong></div>

        <button
          onClick={handleWallet}
          disabled={!!processing || walletBalance === null || !walletSufficient}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px',
            background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '10px', cursor: (!!processing || !walletSufficient) ? 'not-allowed' : 'pointer',
            opacity: processing === 'card' ? 0.4 : (processing === 'wallet' || walletBalance === null) ? 0.7 : (walletSufficient ? 1 : 0.5),
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--brand-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {processing === 'wallet' && <Spinner color="var(--brand-light)" />}
            {t('payment.walletOption')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {processing === 'wallet' ? t('payment.processing') : walletBalance === null ? t('payment.walletLoading') : walletSufficient
              ? t('payment.walletAvailable', { balance: walletBalance.toFixed(2) })
              : t('payment.walletInsufficient', { balance: walletBalance.toFixed(2) })}
          </span>
        </button>

        <button
          onClick={handleCard}
          disabled={!!processing}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px',
            background: processing === 'card' ? 'var(--surface2)' : 'var(--surface2)', border: '1px solid ' + (processing === 'card' ? 'var(--brand)' : 'var(--border)'), borderRadius: '10px',
            padding: '12px 14px', marginBottom: '14px', cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing === 'wallet' ? 0.4 : 1,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {processing === 'card' && <Spinner color="var(--text)" />}
            {t('payment.cardOption')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {processing === 'card' ? t('payment.redirectingToCard') : t('payment.cardSubtitle')}
          </span>
        </button>

        <button onClick={onClose} disabled={!!processing} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: processing ? 'not-allowed' : 'pointer', padding: '6px', opacity: processing ? 0.5 : 1 }}>
          {t('payment.cancel')}
        </button>
      </div>
    </div>
  )
}

function Spinner({ color }) {
  return (
    <span
      style={{
        width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0,
        border: '2px solid ' + color, borderTopColor: 'transparent',
        animation: 'payment-modal-spin 0.7s linear infinite',
        display: 'inline-block', opacity: 0.85,
      }}
    >
      <style>{'@keyframes payment-modal-spin { to { transform: rotate(360deg) } }'}</style>
    </span>
  )
}

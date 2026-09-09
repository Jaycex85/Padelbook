'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

// Props :
//   amount        : montant dû (€)
//   onChooseCard  : () => void  — déclenche le flow PayConic existant
//   onChooseWallet: () => Promise<void> — débite le wallet et marque payé
//   onClose       : () => void
export default function PaymentMethodModal({ amount, onChooseCard, onChooseWallet, onClose }) {
  const [walletBalance, setWalletBalance] = useState(null)
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

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
    setProcessing(true)
    await onChooseWallet()
    setProcessing(false)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '340px' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Comment payer votre part ?</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>Montant dû : <strong style={{ color: 'var(--brand-light)' }}>{amount.toFixed(2)} €</strong></div>

        <button
          onClick={handleWallet}
          disabled={processing || walletBalance === null || !walletSufficient}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px',
            background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '10px', cursor: (processing || !walletSufficient) ? 'not-allowed' : 'pointer',
            opacity: (processing || walletBalance === null) ? 0.7 : (walletSufficient ? 1 : 0.5),
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--brand-light)' }}>💳 Wallet PadelBook</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {walletBalance === null ? 'Chargement du solde...' : walletSufficient
              ? `Solde disponible : ${walletBalance.toFixed(2)} €`
              : `Solde insuffisant (${walletBalance.toFixed(2)} € disponible)`}
          </span>
        </button>

        <button
          onClick={onChooseCard}
          disabled={processing}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '14px', cursor: processing ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '14px' }}>💳 Carte bancaire</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Paiement en ligne sécurisé</span>
        </button>

        <button onClick={onClose} disabled={processing} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', padding: '6px' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}

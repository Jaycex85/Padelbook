'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { Suspense } from 'react'

function StubPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ref = searchParams.get('ref')
  const bookingId = searchParams.get('booking')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function confirmPayment() {
    setProcessing(true)
    // Mettre à jour le paiement
    await supabase.from('payments').update({ status: 'paid' }).eq('payconic_ref', ref)
    // Mettre à jour la réservation
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
    setDone(true)
    setProcessing(false)
    setTimeout(() => router.push('/my-bookings'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--green)', marginBottom: '8px' }}>Paiement confirmé !</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Redirection vers vos réservations...</p>
          </>
        ) : (
          <>
            <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '8px 14px', display: 'inline-block', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>⚠️ Mode STUB — PayConic non connecté</span>
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Simulation de paiement</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              Référence : <code style={{ fontFamily: 'monospace', color: 'var(--green)' }}>{ref}</code>
            </p>
            <button onClick={confirmPayment} disabled={processing}
              style={{ width: '100%', background: 'var(--green)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: processing ? 0.6 : 1 }}>
              {processing ? 'Traitement...' : 'Simuler le paiement ✓'}
            </button>
            <button onClick={() => router.back()} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '11px', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function StubPaymentPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>}>
      <StubPaymentContent />
    </Suspense>
  )
}

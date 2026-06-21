'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { Suspense } from 'react'

function StubPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ref = searchParams.get('ref')
  const bookingId = searchParams.get('booking')
  const eventRegistrationId = searchParams.get('event_registration')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function confirmPayment() {
    setProcessing(true)

    if (bookingId) {
      await supabase.from('payments').update({ status: 'paid' }).eq('payconic_ref', ref)
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
    }

    if (eventRegistrationId) {
      await supabase.from('event_registrations').update({ status: 'confirmed', payment_status: 'paid' }).eq('id', eventRegistrationId)
    }

    setDone(true)
    setProcessing(false)
    setTimeout(() => router.push(eventRegistrationId ? '/events' : '/my-bookings'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand-light)', marginBottom: '8px' }}>Paiement confirmé !</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Redirection...</p>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '8px', padding: '8px 14px', display: 'inline-block', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--brand-light)', fontWeight: 500 }}>⚠️ Mode STUB — PayConic non connecté</span>
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Simulation de paiement</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              Référence : <code style={{ fontFamily: 'monospace', color: 'var(--brand-light)' }}>{ref}</code>
            </p>
            <button onClick={confirmPayment} disabled={processing}
              style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: processing ? 0.6 : 1 }}>
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

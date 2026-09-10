'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import PaymentMethodModal from '../../components/PaymentMethodModal'
import { goToPaymentUrl } from '../../lib/paymentNav'
import { sportColor } from '../../lib/sportColors'
import { useSport } from '../../lib/sportContext'

const STATUS_LABELS = {
  none: 'Aucune demande',
  awaiting_payment: 'En attente de paiement',
  awaiting_validation: 'En attente de validation par le club',
  active: 'Actif',
  rejected: 'Demande refusée',
  expired: 'Expiré',
}

export default function MembershipPage() {
  const [types, setTypes] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(null)
  const [pendingPayment, setPendingPayment] = useState(null) // { requestId, amount }
  const supabase = createClient()
  const router = useRouter()
  const { activeSport } = useSport()

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('membership_types').select('*').eq('active', true).order('sport').order('sort_order'),
      supabase.from('membership_requests').select('*, membership_type:membership_types(*)').eq('profile_id', user.id),
    ])
    setTypes(t || [])
    setRequests(r || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function statusFor(typeId) {
    // La demande la plus récente prévaut (permet de redemander après refus/expiration).
    const reqs = requests.filter(r => r.membership_type_id === typeId).sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
    const r = reqs[0]
    if (!r) return { key: 'none' }
    if (r.status === 'active' && r.valid_until && r.valid_until < new Date().toISOString().split('T')[0]) {
      return { key: 'expired', request: r }
    }
    if (r.status === 'pending' && r.payment_status !== 'paid') return { key: 'awaiting_payment', request: r }
    if (r.status === 'pending' && r.payment_status === 'paid') return { key: 'awaiting_validation', request: r }
    return { key: r.status, request: r }
  }

  async function handleRequest(type) {
    setRequesting(type.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newRequest } = await supabase.from('membership_requests').insert({
      profile_id: user.id,
      membership_type_id: type.id,
      price: type.price,
      status: 'pending',
      payment_status: type.price > 0 ? 'pending' : 'paid',
    }).select().single()
    setRequesting(null)

    if (newRequest) {
      if (type.price > 0) {
        setPendingPayment({ requestId: newRequest.id, amount: type.price })
      } else {
        load()
      }
    }
  }

  async function payViaWallet() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
    const available = prof?.wallet_balance || 0
    if (available >= pendingPayment.amount) {
      await supabase.from('profiles').update({ wallet_balance: available - pendingPayment.amount }).eq('id', user.id)
      await supabase.from('wallet_transactions').insert({
        profile_id: user.id, amount: -pendingPayment.amount, type: 'debit',
        description: 'Adhésion / licence',
      })
      await supabase.from('membership_requests').update({ payment_status: 'paid' }).eq('id', pendingPayment.requestId)
    }
    setPendingPayment(null)
    load()
  }

  async function payViaCard() {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membership_request_id: pendingPayment.requestId, amount: pendingPayment.amount }),
    })
    const payData = await res.json().catch(() => ({}))
    if (payData.payment_url) goToPaymentUrl(router, payData.payment_url)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const bySport = { padel: types.filter(t => t.sport === 'padel'), badminton: types.filter(t => t.sport === 'badminton') }
  const sportsToShow = activeSport ? [activeSport] : ['padel', 'badminton']

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700 }}>Adhésions et cotisations</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>
          Licences et statuts compétiteur pour le {activeSport === 'badminton' ? 'badminton' : 'padel'}. Chaque demande est validée par le club après paiement.
        </p>
      </div>

      {sportsToShow.map(sport => {
        if (bySport[sport].length === 0) return null
        const col = sportColor(sport)
        return (
          <div key={sport} style={{ marginBottom: '28px' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: col.text }}>
              {sport === 'padel' ? 'Padel' : 'Badminton'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bySport[sport].map(type => {
                const status = statusFor(type.id)
                return (
                  <div key={type.id} style={{ background: 'var(--surface)', border: '1px solid ' + col.border, borderLeft: '3px solid ' + col.border, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{type.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {type.price > 0 ? type.price.toFixed(2) + ' €' : 'Gratuit'}
                        {status.request && status.key === 'active' && status.request.valid_until && (
                          <> · valide jusqu'au {new Date(status.request.valid_until).toLocaleDateString('fr-BE')}</>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {status.key !== 'none' && (
                        <span style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500,
                          background: status.key === 'active' ? 'rgba(74,222,128,0.1)' : status.key === 'rejected' ? 'rgba(248,113,113,0.1)' : status.key === 'expired' ? 'rgba(139,148,158,0.12)' : 'rgba(252,211,77,0.1)',
                          color: status.key === 'active' ? '#4ADE80' : status.key === 'rejected' ? 'var(--red)' : status.key === 'expired' ? 'var(--muted)' : 'var(--amber)',
                        }}>
                          {STATUS_LABELS[status.key]}
                        </span>
                      )}

                      {(status.key === 'none' || status.key === 'rejected' || status.key === 'expired') && (
                        <button onClick={() => handleRequest(type)} disabled={requesting === type.id}
                          style={{ background: col.dim, border: '1px solid ' + col.border, color: col.text, borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          {requesting === type.id ? '...' : status.key === 'expired' ? 'Renouveler' : 'Demander'}
                        </button>
                      )}
                      {status.key === 'awaiting_payment' && (
                        <button onClick={() => setPendingPayment({ requestId: status.request.id, amount: status.request.price })}
                          style={{ background: col.dim, border: '1px solid ' + col.border, color: col.text, borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          Payer
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {pendingPayment && (
        <PaymentMethodModal
          amount={pendingPayment.amount}
          onChooseWallet={payViaWallet}
          onChooseCard={payViaCard}
          onClose={() => setPendingPayment(null)}
        />
      )}
    </div>
  )
}

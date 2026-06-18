'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const STATUS_STYLES = {
  confirmed: { bg: 'rgba(74,222,128,0.1)', color: 'var(--green)', label: 'Confirmé' },
  pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)', label: 'En attente de paiement' },
  cancelled: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)', label: 'Annulé' },
  completed: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Terminé' },
  expired: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Expiré' },
}

function MyBookingsList() {
  const searchParams = useSearchParams()
  const newId = searchParams.get('new')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('bookings')
      .select('*, court:courts(name, is_indoor), players:booking_players(id, player_id, is_owner, payment_status, effective_price)')
      .eq('owner_id', user.id)
      .order('starts_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCancel(booking) {
    const deadline = booking.cancellation_deadline ? new Date(booking.cancellation_deadline) : null
    const now = new Date()
    if (deadline && now > deadline) {
      alert("Le délai d'annulation gratuite est dépassé.")
      return
    }
    setCancelling(booking.id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    setCancelling(null)
    load()
  }

  async function togglePublic(booking) {
    await supabase.from('bookings').update({ is_public: !booking.is_public }).eq('id', booking.id)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  return (
    <div>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Mes réservations</h1>

      {newId && (
        <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '14px', color: 'var(--green)' }}>
          ✓ Réservation créée avec succès. En attente de paiement.
        </div>
      )}

      {bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎾</div>
          <p style={{ marginBottom: '16px' }}>Aucune réservation.</p>
          <a href="/booking" style={{ background: 'var(--green)', color: '#0D1117', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Réserver un terrain
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bookings.map(b => {
            const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending
            const paidCount = (b.players || []).filter(p => p.payment_status === 'paid').length
            const canCancel = ['pending', 'confirmed'].includes(b.status)
            return (
              <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid ' + (b.id === newId ? 'var(--green)' : 'var(--border)'), borderRadius: '16px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>{b.court?.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: b.court?.is_indoor ? 'rgba(96,165,250,0.1)' : 'rgba(74,222,128,0.1)', color: b.court?.is_indoor ? '#93C5FD' : 'var(--green)' }}>
                        {b.court?.is_indoor ? 'Indoor' : 'Outdoor'}
                      </span>
                      {b.is_public && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Public</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '6px' }}>
                      {fmt(b.starts_at)} · {fmtTime(b.starts_at)} → {fmtTime(b.ends_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{paidCount}/{b.players?.length || 1} joueur{paidCount !== 1 ? 's' : ''} payé{paidCount !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: '13px', color: 'var(--green)', fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>{b.total_price} €</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    {canCancel && (
                      <button onClick={() => handleCancel(b)} disabled={cancelling === b.id}
                        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                        {cancelling === b.id ? '...' : 'Annuler'}
                      </button>
                    )}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button onClick={() => togglePublic(b)}
                        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                        {b.is_public ? 'Rendre privé' : 'Rendre public'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>}>
      <MyBookingsList />
    </Suspense>
  )
}

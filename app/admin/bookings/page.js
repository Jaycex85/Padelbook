'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const STATUS_STYLES = {
  confirmed: { bg: 'rgba(74,222,128,0.1)', color: 'var(--green)', label: 'Confirmé' },
  pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)', label: 'En attente' },
  cancelled: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)', label: 'Annulé' },
  completed: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Terminé' },
  expired: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Expiré' },
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  async function load() {
    setLoading(true)
    let q = supabase.from('bookings').select('*, court:courts(name), owner:profiles(first_name, last_name, email), players:booking_players(id, payment_status, effective_price)').order('starts_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function updateStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  const ownerName = b => b.owner ? ((b.owner.first_name || '') + ' ' + (b.owner.last_name || '')).trim() || b.owner.email : '—'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Réservations</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{bookings.length} résultat{bookings.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? 'rgba(74,222,128,0.08)' : 'var(--surface)', border: '1px solid ' + (filter === f ? 'var(--green)' : 'var(--border)'), color: filter === f ? 'var(--green)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
              {f === 'all' ? 'Tout' : STATUS_STYLES[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Terrain', 'Joueur', 'Date', 'Créneau', 'Montant', 'Joueurs', 'Statut', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending
                  const paidCount = (b.players || []).filter(p => p.payment_status === 'paid').length
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' }}>{b.court?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{ownerName(b)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(b.starts_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>{fmtTime(b.starts_at)} – {fmtTime(b.ends_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--green)', fontFamily: "'Syne',sans-serif", whiteSpace: 'nowrap' }}>{b.total_price} €</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{paidCount}/{b.players?.length || 0}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>{s.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {b.status === 'pending' && (
                            <button onClick={() => updateStatus(b.id, 'confirmed')}
                              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid var(--green)', color: 'var(--green)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>
                              Confirmer
                            </button>
                          )}
                          {['pending', 'confirmed'].includes(b.status) && (
                            <button onClick={() => updateStatus(b.id, 'cancelled')}
                              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {bookings.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucune réservation.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

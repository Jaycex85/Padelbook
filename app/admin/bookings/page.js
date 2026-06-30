'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DeletionHistory from '../../../components/DeletionHistory'

const STATUS_STYLES = {
  confirmed: { bg: 'var(--brand-dim)', color: 'var(--brand-light)', label: 'Confirmé' },
  pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)', label: 'En attente' },
  cancelled: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)', label: 'Annulé' },
  completed: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Terminé' },
  expired: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Expiré' },
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    // Snapshot complet pour l'historique avant suppression
    const { data: fullBooking } = await supabase
      .from('bookings')
      .select('*, players:booking_players(*), payments(*), match_results(*)')
      .eq('id', deleteTarget.id)
      .single()

    const { data: { user } } = await supabase.auth.getUser()
    const label = (deleteTarget.court?.name || 'Terrain') + ' — ' + new Date(deleteTarget.starts_at).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date(deleteTarget.starts_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

    await supabase.from('deletion_log').insert({
      entity_type: 'booking',
      entity_id: deleteTarget.id,
      label,
      snapshot: fullBooking || deleteTarget,
      deleted_by: user?.id,
    })

    // Supprimer d'abord les enregistrements liés (paiements, joueurs) pour respecter les FK
    await supabase.from('payments').delete().eq('booking_id', deleteTarget.id)
    await supabase.from('booking_players').delete().eq('booking_id', deleteTarget.id)
    await supabase.from('match_results').delete().eq('booking_id', deleteTarget.id)
    await supabase.from('bookings').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  const ownerName = b => b.owner ? ((b.owner.first_name || '') + ' ' + (b.owner.last_name || '')).trim() || b.owner.email : '—'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Réservations</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{bookings.length} résultat{bookings.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', overflowX: 'auto' }}>
        {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? 'var(--brand-dim)' : 'var(--surface)', border: '1px solid ' + (filter === f ? 'var(--brand)' : 'var(--border)'), color: filter === f ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {f === 'all' ? 'Tout' : STATUS_STYLES[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '14px' }}>Aucune réservation.</div>
      ) : (
        <>
          {/* ─── DESKTOP : tableau ─── */}
          <div className="table-desktop-only" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
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
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--brand-light)', fontFamily: "'Syne',sans-serif", whiteSpace: 'nowrap' }}>{b.total_price} €</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{paidCount}/{b.players?.length || 0}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>{s.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {b.status === 'pending' && (
                              <button onClick={() => updateStatus(b.id, 'confirmed')} style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Confirmer</button>
                            )}
                            {['pending', 'confirmed'].includes(b.status) && (
                              <button onClick={() => updateStatus(b.id, 'cancelled')} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Annuler</button>
                            )}
                            <button onClick={() => setDeleteTarget(b)} title="Supprimer définitivement" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── MOBILE : cards ─── */}
          <div className="cards-mobile-only">
            {bookings.map(b => {
              const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending
              const paidCount = (b.players || []).filter(p => p.payment_status === 'paid').length
              return (
                <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.court?.name || '—'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName(b)}</div>
                    </div>
                    <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500, flexShrink: 0 }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                    <span>{fmt(b.starts_at)}</span>
                    <span>{fmtTime(b.starts_at)} – {fmtTime(b.ends_at)}</span>
                    <span>{paidCount}/{b.players?.length || 0} payé{paidCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, color: 'var(--brand-light)' }}>{b.total_price} €</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {b.status === 'pending' && (
                        <button onClick={() => updateStatus(b.id, 'confirmed')} style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>Confirmer</button>
                      )}
                      {['pending', 'confirmed'].includes(b.status) && (
                        <button onClick={() => updateStatus(b.id, 'cancelled')} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>Annuler</button>
                      )}
                      <button onClick={() => setDeleteTarget(b)} title="Supprimer" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <DeletionHistory entityTypes={['booking']} title="Historique des réservations supprimées" />

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: 'min(420px, calc(100vw - 32px))' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
              Supprimer cette réservation ?
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>
              {deleteTarget.court?.name} — {fmt(deleteTarget.starts_at)} à {fmtTime(deleteTarget.starts_at)}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--amber)', marginBottom: '20px' }}>
              Un snapshot sera conservé dans l'historique des suppressions, mais l'élément disparaîtra des listes actives.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

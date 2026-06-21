'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const WHO_LABELS = { all: 'Tout le monde', member: 'Membres uniquement', public: 'Public uniquement' }

export default function AdminEventsPage() {
  const [events, setEvents] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    label: '', starts_at: '', ends_at: '', max_players: 8,
    price_per_player: 10, description: '', who: 'all',
    cancellation_deadline_hours: 24, court_ids: [],
  })
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: ev }, { data: c }] = await Promise.all([
      supabase.from('club_events').select('*, club_event_courts(court_id, courts(name)), event_registrations(id, status, payment_status)').order('starts_at', { ascending: false }),
      supabase.from('courts').select('id, name').eq('status', 'active').order('sort_order'),
    ])
    setEvents(ev || [])
    setCourts(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleCourt(id) {
    setForm(f => ({
      ...f,
      court_ids: f.court_ids.includes(id) ? f.court_ids.filter(x => x !== id) : [...f.court_ids, id]
    }))
  }

  function resetForm() {
    setForm({ label: '', starts_at: '', ends_at: '', max_players: 8, price_per_player: 10, description: '', who: 'all', cancellation_deadline_hours: 24, court_ids: [] })
  }

  async function handleCreate() {
    if (!form.label || !form.starts_at || !form.ends_at || form.court_ids.length === 0) return
    setSaving(true)

    // 1. Créer l'événement
    const { data: event, error: evErr } = await supabase.from('club_events').insert({
      label: form.label,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      max_players: parseInt(form.max_players),
      price_per_player: parseFloat(form.price_per_player),
      description: form.description || null,
      who: form.who,
      cancellation_deadline_hours: parseInt(form.cancellation_deadline_hours),
    }).select().single()

    if (evErr) { console.error(evErr); setSaving(false); return }

    // 2. Pour chaque terrain sélectionné : créer un block + la liaison club_event_courts
    for (const courtId of form.court_ids) {
      const { data: block } = await supabase.from('blocks').insert({
        court_id: courtId,
        reason: 'event',
        label: 'Mayfair Padel — ' + form.label,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        all_courts: false,
      }).select().single()

      await supabase.from('club_event_courts').insert({
        event_id: event.id,
        court_id: courtId,
        block_id: block?.id || null,
      })
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    load()
  }

  async function cancelEvent(event) {
    if (!confirm("Annuler l'événement \"" + event.label + "\" ? Les terrains seront débloqués.")) return
    // Supprimer les blocks liés
    const blockIds = (event.club_event_courts || []).map(c => c.block_id).filter(Boolean)
    if (blockIds.length > 0) {
      await supabase.from('blocks').delete().in('id', blockIds)
    }
    await supabase.from('club_events').update({ status: 'cancelled' }).eq('id', event.id)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Club Events</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>Tournois, soirées, événements spéciaux du club</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Créer un event
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>Aucun événement créé.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {events.map(ev => {
            const regs = ev.event_registrations || []
            const confirmedCount = regs.filter(r => r.status !== 'cancelled').length
            const paidCount = regs.filter(r => r.payment_status === 'paid').length
            const courtsNames = (ev.club_event_courts || []).map(c => c.courts?.name).filter(Boolean).join(', ')
            const isCancelled = ev.status === 'cancelled'

            return (
              <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid ' + (isCancelled ? 'var(--border)' : 'var(--brand)'), borderRadius: '16px', padding: '16px 20px', opacity: isCancelled ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Mayfair Padel — {ev.label}</span>
                      {isCancelled && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', color: 'var(--red)' }}>Annulé</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                      {fmt(ev.starts_at)} · {fmtTime(ev.starts_at)} → {fmtTime(ev.ends_at)} · {courtsNames}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>
                        {confirmedCount}/{ev.max_players} inscrits
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(74,222,128,0.08)', color: '#4ADE80' }}>
                        {paidCount} payé{paidCount !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>
                        {ev.price_per_player} €/pers
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>
                        {WHO_LABELS[ev.who]}
                      </span>
                    </div>
                  </div>
                  {!isCancelled && (
                    <button onClick={() => cancelEvent(ev)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                      Annuler l'event
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal création */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(540px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>Nouvel événement</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Libellé</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Mayfair Padel —</span>
                <input style={fieldStyle} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Tournoi de printemps" />
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Début</label>
                <input type="datetime-local" style={fieldStyle} value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Fin</label>
                <input type="datetime-local" style={fieldStyle} value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Terrains concernés</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {courts.map(c => (
                  <button key={c.id} onClick={() => toggleCourt(c.id)}
                    style={{ background: form.court_ids.includes(c.id) ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.court_ids.includes(c.id) ? 'var(--brand)' : 'var(--border)'), color: form.court_ids.includes(c.id) ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Joueurs max</label>
                <input type="number" min="1" style={fieldStyle} value={form.max_players} onChange={e => setForm({ ...form, max_players: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Prix / participant (€)</label>
                <input type="number" min="0" step="0.5" style={fieldStyle} value={form.price_per_player} onChange={e => setForm({ ...form, price_per_player: e.target.value })} />
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Qui peut s'inscrire</label>
                <select style={fieldStyle} value={form.who} onChange={e => setForm({ ...form, who: e.target.value })}>
                  <option value="all">Tout le monde</option>
                  <option value="member">Membres uniquement</option>
                  <option value="public">Public uniquement</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Annulation possible jusqu'à (h avant)</label>
                <input type="number" min="0" style={fieldStyle} value={form.cancellation_deadline_hours} onChange={e => setForm({ ...form, cancellation_deadline_hours: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Description (optionnel)</label>
              <textarea style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détails, règlement, format du tournoi..." />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.label || !form.starts_at || !form.ends_at || form.court_ids.length === 0}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Création...' : "Créer l'événement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

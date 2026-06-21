'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { generateSeriesDates, buildOccurrencePayload } from '../../../lib/eventSeriesUtils'

const WHO_LABELS = { all: 'Tout le monde', member: 'Membres uniquement', public: 'Public uniquement' }
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const EMPTY_FORM = {
  label: '', starts_at: '', ends_at: '', max_players: 8,
  price_per_player: 10, description: '', who: 'all',
  cancellation_deadline_hours: 24, court_ids: [],
  day_of_week: 4, start_time: '19:00', end_time: '21:00',
  series_starts_on: '', series_ends_on: '',
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState([])
  const [series, setSeries] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState('single') // 'single' | 'series'
  const [expandedSeries, setExpandedSeries] = useState(null)
  const [editingEventId, setEditingEventId] = useState(null) // si set : on est en mode édition d'un event ponctuel/occurrence

  const [form, setForm] = useState(EMPTY_FORM)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: ev }, { data: sr }, { data: c }] = await Promise.all([
      supabase.from('club_events').select('*, club_event_courts(court_id, courts(name)), event_registrations(id, status, payment_status)').order('starts_at', { ascending: false }),
      supabase.from('club_event_series').select('*, club_event_series_courts(courts(name))').order('created_at', { ascending: false }),
      supabase.from('courts').select('id, name').eq('status', 'active').order('sort_order'),
    ])
    setEvents(ev || [])
    setSeries(sr || [])
    setCourts(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleCourt(id) {
    setForm(f => ({ ...f, court_ids: f.court_ids.includes(id) ? f.court_ids.filter(x => x !== id) : [...f.court_ids, id] }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setMode('single')
    setEditingEventId(null)
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  // Pré-remplit le formulaire pour modifier un event ponctuel ou une occurrence de série
  function openEdit(ev) {
    const toLocalInput = iso => {
      const d = new Date(iso)
      const pad = n => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    }
    setMode('single') // on édite toujours UNE occurrence précise, jamais le moule de la série
    setEditingEventId(ev.id)
    setForm({
      ...EMPTY_FORM,
      label: ev.label,
      starts_at: toLocalInput(ev.starts_at),
      ends_at: toLocalInput(ev.ends_at),
      max_players: ev.max_players,
      price_per_player: ev.price_per_player,
      description: ev.description || '',
      who: ev.who,
      cancellation_deadline_hours: ev.cancellation_deadline_hours,
      court_ids: (ev.club_event_courts || []).map(c => c.court_id),
    })
    setShowForm(true)
  }

  // ─── Création event ponctuel ───
  async function createSingleEvent() {
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

    if (evErr) { console.error(evErr); return }

    for (const courtId of form.court_ids) {
      const { data: block } = await supabase.from('blocks').insert({
        court_id: courtId, reason: 'event',
        label: 'Mayfair Padel — ' + form.label,
        starts_at: form.starts_at, ends_at: form.ends_at, all_courts: false,
      }).select().single()

      await supabase.from('club_event_courts').insert({ event_id: event.id, court_id: courtId, block_id: block?.id || null })
    }
  }

  // ─── Modification d'un event ponctuel OU d'une occurrence de série ───
  async function updateEvent(eventId) {
    // 1. Mettre à jour les champs de l'event
    await supabase.from('club_events').update({
      label: form.label,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      max_players: parseInt(form.max_players),
      price_per_player: parseFloat(form.price_per_player),
      description: form.description || null,
      who: form.who,
      cancellation_deadline_hours: parseInt(form.cancellation_deadline_hours),
    }).eq('id', eventId)

    // 2. Récupérer les liaisons terrain existantes (avec leur block)
    const { data: existingLinks } = await supabase.from('club_event_courts').select('*').eq('event_id', eventId)

    // 3. Supprimer les blocks + liaisons qui ne sont plus sélectionnés
    const toRemove = (existingLinks || []).filter(l => !form.court_ids.includes(l.court_id))
    for (const link of toRemove) {
      if (link.block_id) await supabase.from('blocks').delete().eq('id', link.block_id)
      await supabase.from('club_event_courts').delete().eq('id', link.id)
    }

    // 4. Mettre à jour les dates des blocks existants qui restent sélectionnés
    const stillLinked = (existingLinks || []).filter(l => form.court_ids.includes(l.court_id))
    for (const link of stillLinked) {
      if (link.block_id) {
        await supabase.from('blocks').update({
          starts_at: form.starts_at, ends_at: form.ends_at,
          label: 'Mayfair Padel — ' + form.label,
        }).eq('id', link.block_id)
      }
    }

    // 5. Créer les nouveaux terrains ajoutés
    const existingCourtIds = (existingLinks || []).map(l => l.court_id)
    const newCourtIds = form.court_ids.filter(id => !existingCourtIds.includes(id))
    for (const courtId of newCourtIds) {
      const { data: block } = await supabase.from('blocks').insert({
        court_id: courtId, reason: 'event',
        label: 'Mayfair Padel — ' + form.label,
        starts_at: form.starts_at, ends_at: form.ends_at, all_courts: false,
      }).select().single()
      await supabase.from('club_event_courts').insert({ event_id: eventId, court_id: courtId, block_id: block?.id || null })
    }
  }

  // ─── Création série récurrente : génère toutes les occurrences ───
  async function createSeries() {
    const { data: newSeries, error: srErr } = await supabase.from('club_event_series').insert({
      label: form.label,
      day_of_week: parseInt(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      series_starts_on: form.series_starts_on,
      series_ends_on: form.series_ends_on,
      max_players: parseInt(form.max_players),
      price_per_player: parseFloat(form.price_per_player),
      description: form.description || null,
      who: form.who,
      cancellation_deadline_hours: parseInt(form.cancellation_deadline_hours),
    }).select().single()

    if (srErr) { console.error(srErr); return }

    for (const courtId of form.court_ids) {
      await supabase.from('club_event_series_courts').insert({ series_id: newSeries.id, court_id: courtId })
    }

    const occurrenceDates = generateSeriesDates(form.series_starts_on, form.series_ends_on, parseInt(form.day_of_week))

    for (const date of occurrenceDates) {
      const payload = buildOccurrencePayload(newSeries, date)
      const { data: event } = await supabase.from('club_events').insert(payload).select().single()
      if (!event) continue

      for (const courtId of form.court_ids) {
        const { data: block } = await supabase.from('blocks').insert({
          court_id: courtId, reason: 'event',
          label: 'Mayfair Padel — ' + form.label,
          starts_at: payload.starts_at, ends_at: payload.ends_at, all_courts: false,
        }).select().single()

        await supabase.from('club_event_courts').insert({ event_id: event.id, court_id: courtId, block_id: block?.id || null })
      }
    }
  }

  async function handleSubmit() {
    if (!form.label || form.court_ids.length === 0) return

    if (editingEventId) {
      // Édition : toujours une occurrence unique, jamais le moule de série
      if (!form.starts_at || !form.ends_at) return
      setSaving(true)
      await updateEvent(editingEventId)
      setSaving(false)
      setShowForm(false)
      resetForm()
      load()
      return
    }

    if (mode === 'single' && (!form.starts_at || !form.ends_at)) return
    if (mode === 'series' && (!form.series_starts_on || !form.series_ends_on)) return

    setSaving(true)
    if (mode === 'single') await createSingleEvent()
    else await createSeries()
    setSaving(false)
    setShowForm(false)
    resetForm()
    load()
  }

  async function cancelEvent(event) {
    if (!confirm("Annuler l'événement \"" + event.label + "\" ? Les terrains seront débloqués.")) return
    const blockIds = (event.club_event_courts || []).map(c => c.block_id).filter(Boolean)
    if (blockIds.length > 0) await supabase.from('blocks').delete().in('id', blockIds)
    await supabase.from('club_events').update({ status: 'cancelled' }).eq('id', event.id)
    load()
  }

  async function deleteEvent(event) {
    const regs = event.event_registrations || []
    const activeRegs = regs.filter(r => r.status !== 'cancelled')
    const warning = activeRegs.length > 0
      ? "ATTENTION : " + activeRegs.length + " joueur(s) inscrit(s) seront aussi supprimés. "
      : ""
    if (!confirm(warning + "Supprimer définitivement \"" + event.label + "\" ? Cette action est irréversible.")) return

    const blockIds = (event.club_event_courts || []).map(c => c.block_id).filter(Boolean)
    if (blockIds.length > 0) await supabase.from('blocks').delete().in('id', blockIds)
    // event_registrations et club_event_courts ont ON DELETE CASCADE sur club_events,
    // donc la suppression de l'event suffit à tout nettoyer en base.
    await supabase.from('club_events').delete().eq('id', event.id)
    load()
  }

  async function cancelSeries(seriesItem) {
    if (!confirm("Annuler TOUTE la série \"" + seriesItem.label + "\" ? Toutes les occurrences futures seront annulées et les terrains débloqués.")) return
    const seriesEvents = events.filter(e => e.series_id === seriesItem.id && e.status === 'active' && new Date(e.starts_at) > new Date())
    for (const ev of seriesEvents) {
      const blockIds = (ev.club_event_courts || []).map(c => c.block_id).filter(Boolean)
      if (blockIds.length > 0) await supabase.from('blocks').delete().in('id', blockIds)
      await supabase.from('club_events').update({ status: 'cancelled' }).eq('id', ev.id)
    }
    await supabase.from('club_event_series').update({ status: 'cancelled' }).eq('id', seriesItem.id)
    load()
  }

  async function deleteSeries(seriesItem) {
    const totalRegs = seriesItem.occurrences.reduce((sum, e) => sum + (e.event_registrations || []).filter(r => r.status !== 'cancelled').length, 0)
    const warning = totalRegs > 0
      ? "ATTENTION : " + totalRegs + " inscription(s) au total seront aussi supprimées. "
      : ""
    if (!confirm(warning + "Supprimer définitivement TOUTE la série \"" + seriesItem.label + "\" et ses " + seriesItem.occurrences.length + " occurrence(s) ? Cette action est irréversible.")) return

    for (const ev of seriesItem.occurrences) {
      const blockIds = (ev.club_event_courts || []).map(c => c.block_id).filter(Boolean)
      if (blockIds.length > 0) await supabase.from('blocks').delete().in('id', blockIds)
    }
    // Supprimer toutes les occurrences (cascade sur event_registrations et club_event_courts)
    const eventIds = seriesItem.occurrences.map(e => e.id)
    if (eventIds.length > 0) await supabase.from('club_events').delete().in('id', eventIds)

    await supabase.from('club_event_series').delete().eq('id', seriesItem.id)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  const singleEvents = events.filter(e => !e.series_id)
  const seriesWithCounts = series.map(s => {
    const occ = events.filter(e => e.series_id === s.id)
    const upcoming = occ.filter(e => e.status === 'active' && new Date(e.starts_at) > new Date())
    return { ...s, occurrences: occ, upcomingCount: upcoming.length }
  })

  function renderEventCard(ev, compact) {
    const regs = ev.event_registrations || []
    const confirmedCount = regs.filter(r => r.status !== 'cancelled').length
    const paidCount = regs.filter(r => r.payment_status === 'paid').length
    const courtsNames = (ev.club_event_courts || []).map(c => c.courts?.name).filter(Boolean).join(', ')
    const isCancelled = ev.status === 'cancelled'

    return (
      <div key={ev.id} style={{ background: compact ? 'var(--surface2)' : 'var(--surface)', border: '1px solid ' + (isCancelled ? 'var(--border)' : 'var(--brand)'), borderRadius: compact ? '10px' : '16px', padding: compact ? '12px 16px' : '16px 20px', opacity: isCancelled ? 0.5 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: compact ? '14px' : '16px', fontWeight: 700 }}>
                {compact ? fmt(ev.starts_at) : 'Mayfair Padel — ' + ev.label}
              </span>
              {isCancelled && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', color: 'var(--red)' }}>Annulé</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
              {!compact && (fmt(ev.starts_at) + ' · ')}{fmtTime(ev.starts_at)} → {fmtTime(ev.ends_at)} · {courtsNames}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>{confirmedCount}/{ev.max_players} inscrits</span>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(74,222,128,0.08)', color: '#4ADE80' }}>{paidCount} payé{paidCount !== 1 ? 's' : ''}</span>
              {!compact && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>{ev.price_per_player} €/pers</span>}
            </div>
          </div>
          {!isCancelled && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => openEdit(ev)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--brand-light)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer' }}>
                Modifier
              </button>
              <button onClick={() => cancelEvent(ev)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Club Events</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>Tournois, soirées et séries récurrentes du club</p>
        </div>
        <button onClick={openCreate} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Créer un event
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : (
        <>
          {/* ─── Séries récurrentes ─── */}
          {seriesWithCounts.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '12px', fontWeight: 500 }}>Séries récurrentes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {seriesWithCounts.map(s => {
                  const courtsNames = (s.club_event_series_courts || []).map(c => c.courts?.name).filter(Boolean).join(', ')
                  const isCancelled = s.status === 'cancelled'
                  const isExpanded = expandedSeries === s.id
                  return (
                    <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid ' + (isCancelled ? 'var(--border)' : 'var(--brand)'), borderRadius: '16px', padding: '16px 20px', opacity: isCancelled ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontWeight: 600 }}>🔁 SÉRIE</span>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Mayfair Padel — {s.label}</span>
                            {isCancelled && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', color: 'var(--red)' }}>Annulée</span>}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                            Tous les {DAYS[s.day_of_week]} · {s.start_time?.substring(0,5)} → {s.end_time?.substring(0,5)} · {courtsNames}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                            Du {fmt(s.series_starts_on)} au {fmt(s.series_ends_on)} · {s.occurrences.length} occurrence{s.occurrences.length !== 1 ? 's' : ''} · {s.upcomingCount} à venir
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>{s.price_per_player} €/pers</span>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>{WHO_LABELS[s.who]}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                            💡 Pour modifier une date précise (prix, capacité...), déplie les dates ci-dessous et clique "Modifier" sur l'occurrence concernée.
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => setExpandedSeries(isExpanded ? null : s.id)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                            {isExpanded ? 'Masquer' : 'Voir'} les dates
                          </button>
                          {!isCancelled && (
                            <button onClick={() => cancelSeries(s)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                              Annuler la série
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {s.occurrences.map(ev => renderEventCard(ev, true))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Events ponctuels ─── */}
          <div>
            {seriesWithCounts.length > 0 && <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '12px', fontWeight: 500 }}>Events ponctuels</h2>}
            {singleEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '14px' }}>Aucun événement ponctuel.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {singleEvents.map(ev => renderEventCard(ev, false))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal création / édition */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(560px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>
                {editingEventId ? "Modifier l'événement" : 'Nouvel événement'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm() }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Toggle ponctuel / série — masqué en mode édition (on édite toujours une occurrence unique) */}
            {!editingEventId && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px' }}>
                <button onClick={() => setMode('single')} style={{ flex: 1, background: mode === 'single' ? 'var(--brand)' : 'none', color: mode === 'single' ? '#fff' : 'var(--muted)', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                  📍 Event ponctuel
                </button>
                <button onClick={() => setMode('series')} style={{ flex: 1, background: mode === 'series' ? 'var(--brand)' : 'none', color: mode === 'series' ? '#fff' : 'var(--muted)', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                  🔁 Série récurrente
                </button>
              </div>
            )}

            {editingEventId && (
              <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--brand-light)', marginBottom: '16px' }}>
                ✏️ Modification de cette occurrence uniquement — les autres dates de la série ne sont pas affectées.
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Libellé</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Mayfair Padel —</span>
                <input style={fieldStyle} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder={mode === 'series' ? 'Open du vendredi' : 'Tournoi de printemps'} />
              </div>
            </div>

            {(mode === 'single' || editingEventId) ? (
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
            ) : (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Jour de la semaine</label>
                  <select style={fieldStyle} value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Heure début</label>
                    <input type="time" style={fieldStyle} value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Heure fin</label>
                    <input type="time" style={fieldStyle} value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>
                <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Du (première occurrence)</label>
                    <input type="date" style={fieldStyle} value={form.series_starts_on} onChange={e => setForm({ ...form, series_starts_on: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Au (dernière occurrence)</label>
                    <input type="date" style={fieldStyle} value={form.series_ends_on} onChange={e => setForm({ ...form, series_ends_on: e.target.value })} />
                  </div>
                </div>
                {form.series_starts_on && form.series_ends_on && (
                  <p style={{ fontSize: '12px', color: 'var(--brand-light)', marginBottom: '14px', marginTop: '-8px' }}>
                    Génère {generateSeriesDates(form.series_starts_on, form.series_ends_on, parseInt(form.day_of_week)).length} occurrence(s) — chacune annulable/modifiable indépendamment.
                  </p>
                )}
              </>
            )}

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
                <label style={labelStyle}>Annulation jusqu'à (h avant)</label>
                <input type="number" min="0" style={fieldStyle} value={form.cancellation_deadline_hours} onChange={e => setForm({ ...form, cancellation_deadline_hours: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Description (optionnel)</label>
              <textarea style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détails, règlement, format..." />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); resetForm() }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSubmit} disabled={saving || !form.label || form.court_ids.length === 0}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : editingEventId ? 'Enregistrer' : (mode === 'series' ? 'Créer la série' : "Créer l'événement")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

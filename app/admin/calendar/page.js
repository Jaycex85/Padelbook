'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const COLORS = {
  booking: { bg: 'rgba(124,58,237,0.18)', border: '#7C3AED', text: '#C084FC', badge: '#7C3AED' },
  event:   { bg: 'rgba(74,222,128,0.12)',  border: '#4ADE80', text: '#4ADE80', badge: '#4ADE80' },
  block:   { bg: 'rgba(252,211,77,0.1)',   border: '#FCD34D', text: '#FCD34D', badge: '#FCD34D' },
}
const TYPE_LABELS = { booking: 'Réservation', event: 'Club Event', block: 'Bloc' }

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return a.toISOString().substring(0, 10) === b.toISOString().substring(0, 10)
}

export default function AdminCalendarPage() {
  const [view, setView] = useState('week')
  const [current, setCurrent] = useState(new Date())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const supabase = createClient()

  function getRangeDates() {
    if (view === 'day') {
      const from = new Date(current); from.setHours(0,0,0,0)
      const to = new Date(current); to.setHours(23,59,59,999)
      return { from, to }
    }
    if (view === 'week') {
      const from = startOfWeek(current)
      const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999)
      return { from, to }
    }
    const from = new Date(current.getFullYear(), current.getMonth(), 1)
    const to = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999)
    return { from, to }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRangeDates()
    const f = from.toISOString(), t = to.toISOString()

    const [{ data: bookings }, { data: events }, { data: blocks }] = await Promise.all([
      supabase.from('bookings')
        .select('id, starts_at, ends_at, status, total_price, court:courts(name), owner:profiles(first_name, last_name, email)')
        .in('status', ['confirmed', 'pending'])
        .gte('starts_at', f).lte('starts_at', t),
      supabase.from('club_events')
        .select('id, label, starts_at, ends_at, club_event_courts(courts(name))')
        .eq('status', 'active').gte('starts_at', f).lte('starts_at', t),
      supabase.from('blocks')
        .select('id, label, reason, starts_at, ends_at, all_courts, court:courts(name)')
        .gte('starts_at', f).lte('ends_at', t),
    ])

    setEntries([
      ...(bookings || []).map(b => ({
        type: 'booking',
        label: b.court?.name || 'Terrain',
        sublabel: b.owner ? ((b.owner.first_name || '') + ' ' + (b.owner.last_name || '')).trim() || b.owner.email : '',
        starts_at: b.starts_at, ends_at: b.ends_at,
        status: b.status, price: b.total_price,
        color: COLORS.booking,
      })),
      ...(events || []).map(e => ({
        type: 'event',
        label: 'Mayfair Padel — ' + e.label,
        sublabel: (e.club_event_courts || []).map(c => c.courts?.name).filter(Boolean).join(', '),
        starts_at: e.starts_at, ends_at: e.ends_at,
        color: COLORS.event,
      })),
      ...(blocks || []).map(b => ({
        type: 'block',
        label: b.label || b.reason,
        sublabel: b.all_courts ? 'Tous terrains' : (b.court?.name || ''),
        starts_at: b.starts_at, ends_at: b.ends_at,
        color: COLORS.block,
      })),
    ].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))

    setLoading(false)
  }, [view, current])

  useEffect(() => { load() }, [load])

  function navigate(dir) {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
  }

  function formatHeader() {
    if (view === 'day') return current.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (view === 'week') {
      const from = startOfWeek(current)
      const to = new Date(from); to.setDate(from.getDate() + 6)
      return from.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) + ' — ' + to.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    return current.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
  }

  const fmtTime = iso => new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = iso => new Date(iso).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })

  function entriesForDay(day) {
    return entries.filter(e => isSameDay(new Date(e.starts_at), day))
  }

  // ── Chip entrée ─────────────────────────────────────────────
  function EntryChip({ entry, compact }) {
    return (
      <button
        onClick={() => setSelected(entry)}
        style={{
          width: '100%', textAlign: 'left',
          background: entry.color.bg,
          border: '1px solid ' + entry.color.border,
          borderLeft: '3px solid ' + entry.color.border,
          borderRadius: '6px',
          padding: compact ? '3px 7px' : '5px 9px',
          marginBottom: '3px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: compact ? '11px' : '12px', fontWeight: 600, color: entry.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fmtTime(entry.starts_at)} {entry.label}
          </div>
          {!compact && entry.sublabel && (
            <div style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {entry.sublabel}
            </div>
          )}
        </div>
      </button>
    )
  }

  // ── Vue semaine : ligne par jour ─────────────────────────────
  function WeekView() {
    const from = startOfWeek(current)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(from); d.setDate(from.getDate() + i); return d
    })
    return (
      <div>
        {days.map((day, i) => {
          const dayEntries = entriesForDay(day)
          const isToday = isSameDay(day, new Date())
          return (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '10px 14px', background: isToday ? 'rgba(124,58,237,0.03)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: dayEntries.length ? '8px' : 0 }}>
                <div style={{ flexShrink: 0, minWidth: '80px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{DAYS_SHORT[i]} </span>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, color: isToday ? 'var(--brand-light)' : 'var(--text)' }}>{day.getDate()}</span>
                  {isToday && <span style={{ fontSize: '9px', background: 'var(--brand)', color: '#fff', borderRadius: '99px', padding: '1px 6px', marginLeft: '6px', fontWeight: 600 }}>Auj.</span>}
                </div>
                {dayEntries.length === 0 && <span style={{ fontSize: '12px', color: 'var(--border)' }}>—</span>}
              </div>
              {dayEntries.length > 0 && (
                <div style={{ paddingLeft: '90px' }}>
                  {dayEntries.map((entry, ei) => <EntryChip key={ei} entry={entry} compact={false} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Vue jour : liste chronologique ───────────────────────────
  function DayView() {
    const dayEntries = entriesForDay(current)
    if (dayEntries.length === 0) {
      return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucune entrée ce jour.</div>
    }
    return (
      <div style={{ padding: '14px' }}>
        {dayEntries.map((entry, i) => (
          <button key={i} onClick={() => setSelected(entry)}
            style={{ width: '100%', textAlign: 'left', background: entry.color.bg, border: '1px solid ' + entry.color.border, borderLeft: '4px solid ' + entry.color.border, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: entry.color.text, marginBottom: '2px' }}>{entry.label}</div>
                {entry.sublabel && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{entry.sublabel}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{fmtTime(entry.starts_at)} → {fmtTime(entry.ends_at)}</div>
                {entry.price && <div style={{ fontSize: '12px', color: 'var(--brand-light)' }}>{entry.price} €</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // ── Vue mois ─────────────────────────────────────────────────
  function MonthView() {
    const year = current.getFullYear(), month = current.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDay = startOfWeek(firstDay)
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDay); d.setDate(startDay.getDate() + i); return d
    })
    const weeks = []
    for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7))

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {DAYS_SHORT.map(d => (
              <th key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', width: '14.28%' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === month
                const isToday = isSameDay(day, new Date())
                const dayEntries = entriesForDay(day)
                return (
                  <td key={di} style={{ borderTop: '1px solid var(--border)', borderRight: di < 6 ? '1px solid var(--border)' : 'none', verticalAlign: 'top', padding: '4px', background: isToday ? 'rgba(124,58,237,0.04)' : 'transparent', opacity: isCurrentMonth ? 1 : 0.3 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '12px', fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--brand-light)' : 'var(--text)', marginBottom: '3px', minHeight: '18px' }}>
                      {day.getDate()}
                    </div>
                    {dayEntries.slice(0, 2).map((entry, ei) => <EntryChip key={ei} entry={entry} compact={true} />)}
                    {dayEntries.length > 2 && (
                      <div style={{ fontSize: '10px', color: 'var(--muted)', paddingLeft: '2px' }}>+{dayEntries.length - 2}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Calendrier</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['booking', 'Réservation'], ['event', 'Event'], ['block', 'Bloc']].map(([t, l]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: COLORS[t].bg, border: '1.5px solid ' + COLORS[t].border }} />
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' }}>‹</button>
          <button onClick={() => setCurrent(new Date())} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px' }}>Auj.</button>
          <button onClick={() => navigate(1)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' }}>›</button>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>{formatHeader()}</div>
        <div style={{ display: 'flex', gap: '3px', background: 'var(--surface2)', padding: '3px', borderRadius: '8px' }}>
          {[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ background: view === v ? 'var(--brand)' : 'none', color: view === v ? '#fff' : 'var(--muted)', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: view === v ? 600 : 400, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grille */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
        ) : view === 'month' ? <MonthView /> : view === 'week' ? <WeekView /> : <DayView />}
      </div>

      {/* Panel détail — s'ouvre au clic, se ferme avec ✕ */}
      {selected && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '2px solid ' + selected.color.border, borderRadius: '16px 16px 0 0', padding: '20px', zIndex: 300, boxShadow: '0 -8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: selected.color.bg, color: selected.color.text, border: '1px solid ' + selected.color.border }}>
                  {TYPE_LABELS[selected.type]}
                </span>
                {selected.status === 'pending' && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>En attente</span>
                )}
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '17px', fontWeight: 700 }}>{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {selected.sublabel && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>
                  {selected.type === 'booking' ? 'Organisateur' : 'Terrain(s)'}
                </div>
                <div style={{ fontSize: '14px' }}>{selected.sublabel}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Date</div>
              <div style={{ fontSize: '14px' }}>{fmtDate(selected.starts_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Créneau</div>
              <div style={{ fontSize: '14px' }}>{fmtTime(selected.starts_at)} → {fmtTime(selected.ends_at)}</div>
            </div>
            {selected.price && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Montant</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, color: 'var(--brand-light)' }}>{selected.price} €</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

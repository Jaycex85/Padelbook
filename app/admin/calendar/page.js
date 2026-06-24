'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7h → 21h

// Couleurs par type d'entrée
const COLORS = {
  booking: { bg: 'rgba(124,58,237,0.18)', border: '#7C3AED', text: '#C084FC' },
  event:   { bg: 'rgba(74,222,128,0.12)', border: '#4ADE80', text: '#4ADE80' },
  block:   { bg: 'rgba(252,211,77,0.1)',  border: '#FCD34D', text: '#FCD34D' },
}

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

function toLocalMidnight(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

export default function AdminCalendarPage() {
  const [view, setView] = useState('week') // 'day' | 'week' | 'month'
  const [current, setCurrent] = useState(new Date())
  const [entries, setEntries] = useState([]) // { type, label, owner, starts_at, ends_at, color }
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const supabase = createClient()

  // Plage à charger selon la vue
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
    // month
    const from = new Date(current.getFullYear(), current.getMonth(), 1)
    const to = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999)
    return { from, to }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRangeDates()
    const f = from.toISOString()
    const t = to.toISOString()

    const [{ data: bookings }, { data: events }, { data: blocks }] = await Promise.all([
      supabase.from('bookings')
        .select('id, starts_at, ends_at, status, total_price, court:courts(name), owner:profiles(first_name, last_name, email)')
        .in('status', ['confirmed', 'pending'])
        .gte('starts_at', f).lte('starts_at', t),
      supabase.from('club_events')
        .select('id, label, starts_at, ends_at, status, club_event_courts(courts(name))')
        .eq('status', 'active')
        .gte('starts_at', f).lte('starts_at', t),
      supabase.from('blocks')
        .select('id, label, reason, starts_at, ends_at, all_courts, court:courts(name)')
        .gte('starts_at', f).lte('ends_at', t),
    ])

    const all = [
      ...(bookings || []).map(b => ({
        type: 'booking',
        label: b.court?.name || 'Terrain',
        sublabel: b.owner ? ((b.owner.first_name || b.owner.email || '').trim()) : '',
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        status: b.status,
        price: b.total_price,
        color: COLORS.booking,
      })),
      ...(events || []).map(e => ({
        type: 'event',
        label: 'Mayfair Padel — ' + e.label,
        sublabel: (e.club_event_courts || []).map(c => c.courts?.name).filter(Boolean).join(', '),
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        color: COLORS.event,
      })),
      ...(blocks || []).map(b => ({
        type: 'block',
        label: b.label || b.reason,
        sublabel: b.all_courts ? 'Tous terrains' : (b.court?.name || ''),
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        color: COLORS.block,
      })),
    ]

    setEntries(all)
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

  function goToday() { setCurrent(new Date()) }

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

  // ── VUE JOUR / SEMAINE ─────────────────────────────────────
  function TimeGrid({ days }) {
    const slotH = 56 // pixels par heure

    function entriesForDay(day) {
      return entries.filter(e => {
        const s = new Date(e.starts_at)
        return isSameDay(s, day)
      })
    }

    function positionEntry(entry) {
      const s = new Date(entry.starts_at)
      const e = new Date(entry.ends_at)
      const startH = s.getHours() + s.getMinutes() / 60
      const endH = e.getHours() + e.getMinutes() / 60
      const top = (startH - 7) * slotH
      const height = Math.max((endH - startH) * slotH, 24)
      return { top, height }
    }

    return (
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px ' + days.map(() => '1fr').join(' '), minWidth: days.length > 1 ? '600px' : '280px' }}>
          {/* En-tête jours */}
          <div style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--surface)' }} />
          {days.map((day, i) => {
            const isToday = isSameDay(day, new Date())
            return (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '8px 6px', textAlign: 'center', background: 'var(--surface)' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{DAYS_SHORT[i % 7]}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: isToday ? 'var(--brand-light)' : 'var(--text)', background: isToday ? 'var(--brand-dim)' : 'none', borderRadius: '50%', width: '28px', height: '28px', lineHeight: '28px', margin: '2px auto 0', textAlign: 'center' }}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}

          {/* Grille horaire */}
          {HOURS.map(h => (
            <>
              <div key={'h' + h} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', height: slotH + 'px', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '6px', paddingTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{h}h</span>
              </div>
              {days.map((day, i) => (
                <div key={'cell' + h + i} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', height: slotH + 'px', position: 'relative', background: h % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  {entriesForDay(day).filter(e => {
                    const sh = new Date(e.starts_at).getHours()
                    return sh === h
                  }).map((entry, ei) => {
                    const { top, height } = positionEntry(entry)
                    const relTop = (h - 7) * slotH
                    return (
                      <div key={ei}
                        onMouseEnter={ev => setTooltip({ entry, x: ev.clientX, y: ev.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => setTooltip(tooltip?.entry === entry ? null : { entry, x: 0, y: 0 })}
                        style={{ position: 'absolute', left: '2px', right: '2px', top: (top - relTop) + 'px', height: height + 'px', background: entry.color.bg, borderLeft: '3px solid ' + entry.color.border, borderRadius: '4px', padding: '2px 5px', overflow: 'hidden', cursor: 'pointer', zIndex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: entry.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.label}</div>
                        {height > 28 && <div style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.sublabel}</div>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
    )
  }

  // ── VUE MOIS ───────────────────────────────────────────────
  function MonthGrid() {
    const year = current.getFullYear()
    const month = current.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDay = startOfWeek(firstDay)
    const cells = []
    const d = new Date(startDay)
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }

    function entriesForDay(day) {
      return entries.filter(e => isSameDay(new Date(e.starts_at), day))
    }

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '8px 6px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', background: 'var(--surface)' }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const isCurrentMonth = day.getMonth() === month
            const isToday = isSameDay(day, new Date())
            const dayEntries = entriesForDay(day)
            return (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minHeight: '80px', padding: '4px', background: isToday ? 'rgba(124,58,237,0.04)' : 'transparent', opacity: isCurrentMonth ? 1 : 0.35 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '13px', fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--brand-light)' : 'var(--text)', marginBottom: '4px' }}>
                  {day.getDate()}
                </div>
                {dayEntries.slice(0, 3).map((entry, ei) => (
                  <div key={ei}
                    onMouseEnter={ev => setTooltip({ entry, x: ev.clientX, y: ev.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ background: entry.color.bg, borderLeft: '2px solid ' + entry.color.border, borderRadius: '3px', padding: '1px 5px', fontSize: '10px', color: entry.color.text, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                    {fmtTime(entry.starts_at)} {entry.label}
                  </div>
                ))}
                {dayEntries.length > 3 && (
                  <div style={{ fontSize: '10px', color: 'var(--muted)', paddingLeft: '4px' }}>+{dayEntries.length - 3} autres</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Jours pour vue jour/semaine
  function getViewDays() {
    if (view === 'day') return [new Date(current)]
    const from = startOfWeek(current)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(from); d.setDate(from.getDate() + i); return d })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Calendrier</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Légende */}
          {[['booking', 'Réservation'], ['event', 'Club Event'], ['block', 'Bloc']].map(([type, label]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: COLORS[type].bg, border: '1.5px solid ' + COLORS[type].border }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '14px' }}>‹</button>
          <button onClick={goToday} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px' }}>Aujourd'hui</button>
          <button onClick={() => navigate(1)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '14px' }}>›</button>
        </div>

        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, flex: 1, textAlign: 'center', minWidth: '180px' }}>
          {formatHeader()}
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', padding: '3px', borderRadius: '8px' }}>
          {[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ background: view === v ? 'var(--brand)' : 'none', color: view === v ? '#fff' : 'var(--muted)', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: view === v ? 600 : 400, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Calendrier */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
        ) : view === 'month' ? (
          <MonthGrid />
        ) : (
          <TimeGrid days={getViewDays()} />
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', top: Math.min(tooltip.y + 12, window.innerHeight - 160), left: Math.min(tooltip.x + 12, window.innerWidth - 220), zIndex: 999, background: 'var(--surface)', border: '1px solid ' + tooltip.entry.color.border, borderRadius: '12px', padding: '12px 14px', minWidth: '200px', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: tooltip.entry.color.text, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            {tooltip.entry.type === 'booking' ? 'Réservation' : tooltip.entry.type === 'event' ? 'Club Event' : 'Bloc'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{tooltip.entry.label}</div>
          {tooltip.entry.sublabel && <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{tooltip.entry.sublabel}</div>}
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {fmtTime(tooltip.entry.starts_at)} → {fmtTime(tooltip.entry.ends_at)}
          </div>
          {tooltip.entry.price && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-light)', marginTop: '4px' }}>{tooltip.entry.price} €</div>
          )}
        </div>
      )}
    </div>
  )
}

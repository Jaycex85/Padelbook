'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'

const PERIODS = [
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: "Cette année" },
  { key: 'custom', label: 'Personnalisé' },
]

function getPeriodDates(period, customFrom, customTo) {
  const now = new Date()
  let from, to
  if (period === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    from = new Date(now); from.setDate(now.getDate() - day); from.setHours(0,0,0,0)
    to = new Date(now); to.setHours(23,59,59,999)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1)
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
  } else {
    from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1)
    to = customTo ? new Date(customTo + 'T23:59:59') : new Date()
  }
  return { from, to }
}

function getPrevPeriodDates(period, from, to) {
  const diff = to - from
  return { from: new Date(from - diff), to: new Date(from) }
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getPeriodDates(period, customFrom, customTo)
    const { from: prevFrom, to: prevTo } = getPrevPeriodDates(period, from, to)

    const fromISO = from.toISOString()
    const toISO = to.toISOString()
    const prevFromISO = prevFrom.toISOString()
    const prevToISO = prevTo.toISOString()

    const [
      { data: bookings },
      { data: prevBookings },
      { data: payments },
      { data: prevPayments },
      { data: members },
      { data: prevMembers },
      { data: courts },
      { data: allBookings },
    ] = await Promise.all([
      supabase.from('bookings').select('id, status, total_price, court_id, starts_at, ends_at, created_at')
        .gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('bookings').select('id, status, total_price, court_id, starts_at, ends_at, created_at')
        .gte('created_at', prevFromISO).lte('created_at', prevToISO),
      supabase.from('payments').select('amount, status, created_at, booking_id')
        .eq('status', 'paid').gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('payments').select('amount, status, created_at, booking_id')
        .eq('status', 'paid').gte('created_at', prevFromISO).lte('created_at', prevToISO),
      supabase.from('profiles').select('id, membership_status, membership_validated_at')
        .eq('membership_status', 'active').gte('membership_validated_at', fromISO).lte('membership_validated_at', toISO),
      supabase.from('profiles').select('id, membership_status, membership_validated_at')
        .eq('membership_status', 'active').gte('membership_validated_at', prevFromISO).lte('membership_validated_at', prevToISO),
      supabase.from('courts').select('id, name').eq('status', 'active'),
      supabase.from('bookings').select('id, court_id, starts_at, ends_at, status, total_price')
        .in('status', ['confirmed', 'completed']).gte('starts_at', fromISO).lte('starts_at', toISO),
    ])

    const confirmed = (bookings || []).filter(b => ['confirmed', 'completed'].includes(b.status))
    const cancelled = (bookings || []).filter(b => b.status === 'cancelled')
    const prevConfirmed = (prevBookings || []).filter(b => ['confirmed', 'completed'].includes(b.status))

    const revenue = (payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const prevRevenue = (prevPayments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)

    // Revenus par jour (pour graphique)
    const revenueByDay = {}
    ;(payments || []).forEach(p => {
      const day = p.created_at.substring(0, 10)
      revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(p.amount || 0)
    })

    // Stats par terrain
    // Construire un index paiements par booking_id pour revenus réels
    const paymentsByBooking = {}
    ;(payments || []).forEach(p => {
      if (p.booking_id) {
        paymentsByBooking[p.booking_id] = (paymentsByBooking[p.booking_id] || 0) + parseFloat(p.amount || 0)
      }
    })

    const courtStats = (courts || []).map(court => {
      const courtBookings = (allBookings || []).filter(b => b.court_id === court.id)
      // Revenus réels = somme des paiements effectivement encaissés pour ce terrain
      const courtRevenue = courtBookings.reduce((s, b) => s + (paymentsByBooking[b.id] || 0), 0)
      // Taux occupation : heures réservées / heures disponibles dans la période
      const periodDays = (to - from) / (24 * 3600 * 1000)
      const openHoursPerDay = 15 // 7h-22h
      const totalAvailableHours = periodDays * openHoursPerDay
      const bookedMinutes = courtBookings.reduce((s, b) => {
        return s + (new Date(b.ends_at) - new Date(b.starts_at)) / 60000
      }, 0)
      const bookedHours = bookedMinutes / 60
      const occupancy = totalAvailableHours > 0 ? Math.round((bookedHours / totalAvailableHours) * 100) : 0
      return { ...court, bookings: courtBookings.length, revenue: courtRevenue, occupancy: Math.min(occupancy, 100), bookedMinutes }
    })

    // Heatmap jour de la semaine (0=Lun..6=Dim) x heure (7h-21h) — nombre de réservations couvrant ce créneau
    const HEATMAP_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i) // 7h..21h
    const heatmapGrid = Array.from({ length: 7 }, () => HEATMAP_HOURS.map(() => 0))
    let weekdayMinutes = 0, weekendMinutes = 0

    ;(allBookings || []).forEach(b => {
      const start = new Date(b.starts_at)
      const end = new Date(b.ends_at)
      const jsDay = start.getDay() // 0=Dim..6=Sam
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1 // 0=Lun..6=Dim
      const isWeekend = jsDay === 0 || jsDay === 6
      const durationMin = (end - start) / 60000
      if (isWeekend) weekendMinutes += durationMin; else weekdayMinutes += durationMin

      let cursor = new Date(start)
      while (cursor < end) {
        const h = cursor.getHours()
        const hIdx = HEATMAP_HOURS.indexOf(h)
        if (hIdx !== -1) heatmapGrid[dayIdx][hIdx]++
        cursor = new Date(cursor.getTime() + 30 * 60000)
      }
    })

    // Heure de pointe globale (toutes journées confondues)
    const hourTotals = HEATMAP_HOURS.map((h, hi) => ({ h, total: heatmapGrid.reduce((s, day) => s + day[hi], 0) }))
    const peakHour = hourTotals.reduce((max, cur) => cur.total > max.total ? cur : max, hourTotals[0])

    const heatmap = {
      grid: heatmapGrid,
      hours: HEATMAP_HOURS,
      weekdayHours: Math.round(weekdayMinutes / 60),
      weekendHours: Math.round(weekendMinutes / 60),
      peakHour: peakHour?.h,
    }

    setData({
      revenue, prevRevenue,
      confirmed: confirmed.length, prevConfirmed: prevConfirmed.length,
      cancelled: cancelled.length,
      newMembers: (members || []).length, prevMembers: (prevMembers || []).length,
      revenueByDay,
      courtStats,
      heatmap,
      rawBookings: bookings || [],
      rawPayments: payments || [],
      from, to,
    })
    setLoading(false)
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  function delta(curr, prev) {
    if (prev === 0) return curr > 0 ? '+100%' : '—'
    const pct = Math.round(((curr - prev) / prev) * 100)
    return (pct >= 0 ? '+' : '') + pct + '%'
  }
  function deltaColor(curr, prev) {
    if (curr > prev) return '#4ADE80'
    if (curr < prev) return 'var(--red)'
    return 'var(--muted)'
  }

  function exportCSV() {
    if (!data) return
    const rows = [
      ['Date', 'Terrain', 'Statut', 'Montant'],
      ...data.rawBookings.map(b => [
        b.starts_at?.substring(0, 10) || '',
        data.courtStats.find(c => c.id === b.court_id)?.name || b.court_id,
        b.status,
        b.total_price,
      ])
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rapport_mayfair_' + data.from.toISOString().substring(0, 10) + '_' + data.to.toISOString().substring(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = v => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(v)
  const fmtDate = d => d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })

  // Graphique revenus — barres SVG simples
  function RevenueChart({ byDay, from, to }) {
    const days = []
    const cur = new Date(from)
    while (cur <= to) {
      days.push(cur.toISOString().substring(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    const maxVal = Math.max(...days.map(d => byDay[d] || 0), 1)
    const barW = Math.max(4, Math.min(32, Math.floor(560 / days.length) - 2))
    const chartH = 120

    return (
      <div style={{ overflowX: 'auto' }}>
        <svg width={Math.max(560, days.length * (barW + 2))} height={chartH + 30} style={{ display: 'block' }}>
          {days.map((day, i) => {
            const val = byDay[day] || 0
            const barH = val > 0 ? Math.max(4, Math.round((val / maxVal) * chartH)) : 0
            const x = i * (barW + 2)
            return (
              <g key={day}>
                <rect x={x} y={chartH - barH} width={barW} height={barH}
                  fill="var(--brand)" opacity="0.85" rx="2" />
                {days.length <= 31 && i % Math.max(1, Math.floor(days.length / 7)) === 0 && (
                  <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                    fontSize="9" fill="var(--muted)">
                    {new Date(day + 'T12:00:00').getDate()}
                  </text>
                )}
              </g>
            )
          })}
          <line x1="0" y1={chartH} x2={days.length * (barW + 2)} y2={chartH}
            stroke="var(--border)" strokeWidth="1" />
        </svg>
      </div>
    )
  }

  function HeatmapChart({ heatmap }) {
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const maxVal = Math.max(...heatmap.grid.flat(), 1)
    const cellSize = 20
    const labelW = 36

    function cellColor(v) {
      if (v === 0) return 'rgba(255,255,255,0.04)'
      const intensity = v / maxVal
      // interpole entre brand-dim et brand
      const alpha = 0.15 + intensity * 0.85
      return `rgba(52, 211, 153, ${alpha})` // approx var(--brand) en rgba
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <svg width={labelW + heatmap.hours.length * (cellSize + 2)} height={DAYS.length * (cellSize + 2) + 20}>
          {heatmap.hours.map((h, hi) => (
            (hi % 2 === 0) && (
              <text key={h} x={labelW + hi * (cellSize + 2) + cellSize / 2} y={DAYS.length * (cellSize + 2) + 14}
                textAnchor="middle" fontSize="9" fill="var(--muted)">{h}h</text>
            )
          ))}
          {DAYS.map((day, di) => (
            <g key={day}>
              <text x={labelW - 6} y={di * (cellSize + 2) + cellSize / 2 + 10} textAnchor="end" fontSize="10" fill="var(--muted)">{day}</text>
              {heatmap.grid[di].map((v, hi) => (
                <rect key={hi} x={labelW + hi * (cellSize + 2)} y={di * (cellSize + 2)}
                  width={cellSize} height={cellSize} rx="3" fill={cellColor(v)}>
                  <title>{day} {heatmap.hours[hi]}h — {v} réservation{v !== 1 ? 's' : ''}</title>
                </rect>
              ))}
            </g>
          ))}
        </svg>
      </div>
    )
  }


      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Rapport financier</h1>
          {data && <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{fmtDate(data.from)} — {fmtDate(data.to)}</p>}
        </div>
        <button onClick={exportCSV} disabled={!data} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Sélecteur période */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{ background: period === p.key ? 'var(--brand-dim)' : 'var(--surface)', border: '1px solid ' + (period === p.key ? 'var(--brand)' : 'var(--border)'), color: period === p.key ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: period === p.key ? 600 : 400 }}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '12px' }} />
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '12px' }} />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--muted)' }}>Chargement...</div>
      ) : !data ? null : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '24px' }}>
            {[
              { icon: '💶', label: 'Revenus', value: fmt(data.revenue), delta: delta(data.revenue, data.prevRevenue), dc: deltaColor(data.revenue, data.prevRevenue) },
              { icon: '✅', label: 'Réservations confirmées', value: data.confirmed, delta: delta(data.confirmed, data.prevConfirmed), dc: deltaColor(data.confirmed, data.prevConfirmed) },
              { icon: '❌', label: 'Annulations', value: data.cancelled, delta: null, dc: null },
              { icon: '🎖️', label: 'Nouvelles adhésions', value: data.newMembers, delta: delta(data.newMembers, data.prevMembers), dc: deltaColor(data.newMembers, data.prevMembers) },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{kpi.icon}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{kpi.label}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>{kpi.value}</div>
                {kpi.delta && (
                  <div style={{ fontSize: '11px', color: kpi.dc, marginTop: '4px' }}>
                    {kpi.delta} vs période préc.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Graphique revenus */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
              Revenus par jour
            </h2>
            <RevenueChart byDay={data.revenueByDay} from={data.from} to={data.to} />
          </div>

          {/* Heatmap horaire */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>
                Affluence — jour & heure
              </h2>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)' }}>
                <span>🕐 Heure de pointe : <strong style={{ color: 'var(--text)' }}>{data.heatmap.peakHour}h</strong></span>
                <span>Semaine : <strong style={{ color: 'var(--text)' }}>{data.heatmap.weekdayHours}h</strong></span>
                <span>Week-end : <strong style={{ color: 'var(--text)' }}>{data.heatmap.weekendHours}h</strong></span>
              </div>
            </div>
            <HeatmapChart heatmap={data.heatmap} />
          </div>

          {/* Stats par terrain */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>Par terrain</h2>
            </div>
            <div>
              {data.courtStats.map(court => (
                <div key={court.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '100px', fontWeight: 500, fontSize: '14px' }}>{court.name}</div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                      <span>Occupation</span>
                      <span>{court.occupancy}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: court.occupancy + '%', background: court.occupancy > 70 ? 'var(--brand)' : court.occupancy > 40 ? '#FCD34D' : 'var(--muted)', borderRadius: '99px', transition: 'width .4s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, color: 'var(--brand-light)' }}>{fmt(court.revenue)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {court.bookings} résa · {Math.floor(court.bookedMinutes / 60)}h{court.bookedMinutes % 60 > 0 ? String(Math.round(court.bookedMinutes % 60)).padStart(2,'0') : ''}
              </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Taux annulation */}
          {data.confirmed + data.cancelled > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Taux d'annulation</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>
                  {Math.round((data.cancelled / (data.confirmed + data.cancelled)) * 100)}%
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {data.cancelled} annulation{data.cancelled !== 1 ? 's' : ''} sur {data.confirmed + data.cancelled} réservation{data.confirmed + data.cancelled !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

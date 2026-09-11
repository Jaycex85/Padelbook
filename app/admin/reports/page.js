'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'
import { sportColor } from '../../../lib/sportColors'
import SportFilterBar from '../../../components/admin/SportFilterBar'

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
  const [sportFilter, setSportFilter] = useState('all')
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
      { data: bookingsRaw },
      { data: prevBookingsRaw },
      { data: billableEvents },
      { data: prevBillableEvents },
      { data: members },
      { data: prevMembers },
      { data: courtsRaw },
      { data: allBookingsRaw },
    ] = await Promise.all([
      supabase.from('bookings').select('id, status, total_price, court_id, starts_at, ends_at, created_at, court:courts(sport)')
        .gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('bookings').select('id, status, total_price, court_id, starts_at, ends_at, created_at, court:courts(sport)')
        .gte('created_at', prevFromISO).lte('created_at', prevToISO),
      supabase.from('billable_events').select('amount, category, sport, payment_method, created_at, booking_id')
        .gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('billable_events').select('amount, category, sport, payment_method, created_at, booking_id')
        .gte('created_at', prevFromISO).lte('created_at', prevToISO),
      supabase.from('profiles').select('id, membership_status, membership_validated_at')
        .eq('membership_status', 'active').gte('membership_validated_at', fromISO).lte('membership_validated_at', toISO),
      supabase.from('profiles').select('id, membership_status, membership_validated_at')
        .eq('membership_status', 'active').gte('membership_validated_at', prevFromISO).lte('membership_validated_at', prevToISO),
      supabase.from('courts').select('id, name, sport').eq('status', 'active'),
      supabase.from('bookings').select('id, court_id, starts_at, ends_at, status, total_price, court:courts(sport)')
        .in('status', ['confirmed', 'completed']).gte('starts_at', fromISO).lte('starts_at', toISO),
    ])

    // Filtre sport, appliqué à toutes les sources avant calcul des stats.
    const bySport = arr => sportFilter === 'all' ? arr : (arr || []).filter(x => x.court?.sport === sportFilter || x.sport === sportFilter)
    const bookings = bySport(bookingsRaw)
    const prevBookings = bySport(prevBookingsRaw)
    const allBookings = bySport(allBookingsRaw)
    const courts = sportFilter === 'all' ? (courtsRaw || []) : (courtsRaw || []).filter(c => c.sport === sportFilter)

    const confirmed = (bookings || []).filter(b => ['confirmed', 'completed'].includes(b.status))
    const cancelled = (bookings || []).filter(b => b.status === 'cancelled')
    const prevConfirmed = (prevBookings || []).filter(b => ['confirmed', 'completed'].includes(b.status))

    // "Facturable" = tout ce qui a réellement été encaissé (wallet ou carte) :
    // réservations, adhésions/licences, club events. La recharge wallet est
    // exclue du chiffre d'affaires (ce n'est qu'un dépôt, pas un revenu tant
    // qu'il n'est pas dépensé — auquel cas il est déjà compté ailleurs).
    // Quand un sport précis est filtré, les éléments "communs" (sport=null,
    // ex: annonce/event partagé) sont exclus — ils ne relèvent d'aucun sport en particulier.
    const billable = bySport((billableEvents || []).filter(e => e.category !== 'wallet_topup'))
    const prevBillable = bySport((prevBillableEvents || []).filter(e => e.category !== 'wallet_topup'))

    const revenue = billable.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
    const prevRevenue = prevBillable.reduce((s, e) => s + parseFloat(e.amount || 0), 0)

    // Revenus par sport (padel / badminton / commun — ex: annonce ou event sans sport dédié)
    const revenueBySport = { padel: 0, badminton: 0, commun: 0 }
    billable.forEach(e => {
      const key = e.sport === 'padel' ? 'padel' : e.sport === 'badminton' ? 'badminton' : 'commun'
      revenueBySport[key] += parseFloat(e.amount || 0)
    })

    // Revenus par catégorie
    const CATEGORY_LABELS = { booking: 'Réservations', membership: 'Adhésions & licences', event: 'Club Events' }
    const revenueByCategory = {}
    billable.forEach(e => {
      const label = CATEGORY_LABELS[e.category] || e.category
      revenueByCategory[label] = (revenueByCategory[label] || 0) + parseFloat(e.amount || 0)
    })

    // Revenus par jour (pour graphique)
    const revenueByDay = {}
    billable.forEach(e => {
      const day = e.created_at.substring(0, 10)
      revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(e.amount || 0)
    })

    // Stats par terrain
    // Construire un index revenus par booking_id (wallet + carte, via le registre unifié)
    const revenueByBooking = {}
    billable.filter(e => e.category === 'booking' && e.booking_id).forEach(e => {
      revenueByBooking[e.booking_id] = (revenueByBooking[e.booking_id] || 0) + parseFloat(e.amount || 0)
    })

    const courtStats = (courts || []).map(court => {
      const courtBookings = (allBookings || []).filter(b => b.court_id === court.id)
      // Revenus réels = somme des paiements effectivement encaissés pour ce terrain
      const courtRevenue = courtBookings.reduce((s, b) => s + (revenueByBooking[b.id] || 0), 0)
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

    // Heatmap jour de la semaine (0=Lun..6=Dim) x demi-heure (9h00-23h00)
    const HEATMAP_SLOTS = []
    for (let h = 9; h <= 23; h++) {
      HEATMAP_SLOTS.push(h * 60)
      if (h < 23) HEATMAP_SLOTS.push(h * 60 + 30)
    }
    // 9h00 → 23h00 = 29 slots de 30min
    const heatmapGrid = Array.from({ length: 7 }, () => HEATMAP_SLOTS.map(() => 0))
    let weekdayMinutes = 0, weekendMinutes = 0

    ;(allBookings || []).forEach(b => {
      const start = new Date(b.starts_at)
      const end = new Date(b.ends_at)
      const jsDay = start.getDay()
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1
      const isWeekend = jsDay === 0 || jsDay === 6
      const durationMin = (end - start) / 60000
      if (isWeekend) weekendMinutes += durationMin; else weekdayMinutes += durationMin

      let cursor = new Date(start)
      while (cursor < end) {
        const slotMin = cursor.getHours() * 60 + cursor.getMinutes()
        const sIdx = HEATMAP_SLOTS.indexOf(slotMin)
        if (sIdx !== -1) heatmapGrid[dayIdx][sIdx]++
        cursor = new Date(cursor.getTime() + 30 * 60000)
      }
    })

    const slotTotals = HEATMAP_SLOTS.map((s, si) => ({ s, total: heatmapGrid.reduce((acc, day) => acc + day[si], 0) }))
    const peakSlot = slotTotals.reduce((max, cur) => cur.total > max.total ? cur : max, slotTotals[0])
    const peakH = Math.floor(peakSlot.s / 60)
    const peakM = peakSlot.s % 60

    function fmtMinutes(mins) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return m > 0 ? h + 'h' + String(m).padStart(2,'0') : h + 'h'
    }

    const heatmap = {
      grid: heatmapGrid,
      slots: HEATMAP_SLOTS,
      weekdayHours: fmtMinutes(weekdayMinutes),
      weekendHours: fmtMinutes(weekendMinutes),
      peakHour: peakH + 'h' + (peakM > 0 ? String(peakM).padStart(2,'0') : ''),
    }

    setData({
      revenue, prevRevenue,
      revenueBySport, revenueByCategory,
      confirmed: confirmed.length, prevConfirmed: prevConfirmed.length,
      cancelled: cancelled.length,
      newMembers: (members || []).length, prevMembers: (prevMembers || []).length,
      revenueByDay,
      courtStats,
      heatmap,
      allBookings: allBookings || [],
      rawBookings: bookings || [],
      rawBillable: billable,
      from, to,
    })
    setLoading(false)
  }, [period, customFrom, customTo, sportFilter])

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
      ['Date', 'Catégorie', 'Sport', 'Mode de paiement', 'Montant'],
      ...data.rawBillable.map(e => [
        e.created_at?.substring(0, 10) || '',
        e.category === 'booking' ? 'Réservation' : e.category === 'membership' ? 'Adhésion/licence' : e.category === 'event' ? 'Club Event' : e.category,
        e.sport === 'badminton' ? 'Badminton' : e.sport === 'padel' ? 'Padel' : 'Commun',
        e.payment_method === 'wallet' ? 'Wallet' : 'Carte',
        e.amount,
      ])
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rapport_brussels_bp_' + data.from.toISOString().substring(0, 10) + '_' + data.to.toISOString().substring(0, 10) + '.csv'
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

  const [heatmapWeekOffset, setHeatmapWeekOffset] = useState(0)

  function getWeekBounds(offset) {
    const now = new Date()
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + offset * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { monday, sunday }
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return { week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7), year: d.getUTCFullYear() }
  }

  function computeHeatmap(bookings, weekOffset) {
    const { monday, sunday } = getWeekBounds(weekOffset)
    const weekBookings = (bookings || []).filter(b => {
      const s = new Date(b.starts_at)
      return s >= monday && s <= sunday
    })

    const HEATMAP_SLOTS = []
    for (let h = 9; h <= 23; h++) {
      HEATMAP_SLOTS.push(h * 60)
      if (h < 23) HEATMAP_SLOTS.push(h * 60 + 30)
    }
    const heatmapGrid = Array.from({ length: 7 }, () => HEATMAP_SLOTS.map(() => 0))
    let weekdayMinutes = 0, weekendMinutes = 0

    weekBookings.forEach(b => {
      const start = new Date(b.starts_at)
      const end = new Date(b.ends_at)
      const jsDay = start.getDay()
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1
      const isWeekend = jsDay === 0 || jsDay === 6
      const durationMin = (end - start) / 60000
      if (isWeekend) weekendMinutes += durationMin; else weekdayMinutes += durationMin

      let cursor = new Date(start)
      while (cursor < end) {
        const slotMin = cursor.getHours() * 60 + cursor.getMinutes()
        const sIdx = HEATMAP_SLOTS.indexOf(slotMin)
        if (sIdx !== -1) heatmapGrid[dayIdx][sIdx]++
        cursor = new Date(cursor.getTime() + 30 * 60000)
      }
    })

    const slotTotals = HEATMAP_SLOTS.map((s, si) => ({ s, total: heatmapGrid.reduce((acc, day) => acc + day[si], 0) }))
    const peakSlot = slotTotals.reduce((max, cur) => cur.total > max.total ? cur : max, slotTotals[0])
    const peakH = Math.floor(peakSlot.s / 60)
    const peakM = peakSlot.s % 60

    function fmtMin(mins) {
      const h = Math.floor(mins / 60), m = mins % 60
      return m > 0 ? h + 'h' + String(m).padStart(2,'0') : h + 'h'
    }

    return {
      grid: heatmapGrid,
      slots: HEATMAP_SLOTS,
      weekdayHours: fmtMin(weekdayMinutes),
      weekendHours: fmtMin(weekendMinutes),
      peakHour: peakH + 'h' + (peakM > 0 ? String(peakM).padStart(2,'0') : ''),
      monday,
      ...getWeekNumber(monday),
    }
  }

  function HeatmapChart({ heatmap }) {
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const maxVal = Math.max(...heatmap.grid.flat(), 1)
    const cellSize = 14
    const cellGap = 1
    const labelW = 36

    function cellColor(v) {
      if (v === 0) return 'rgba(255,255,255,0.04)'
      const intensity = v / maxVal
      const alpha = 0.15 + intensity * 0.85
      return 'rgba(124, 58, 237, ' + alpha + ')'
    }

    const totalW = labelW + heatmap.slots.length * (cellSize + cellGap)
    const totalH = DAYS.length * (cellSize + cellGap) + 20

    return (
      <div style={{ overflowX: 'auto' }}>
        <svg width={totalW} height={totalH}>
          {heatmap.slots.map((s, si) => {
            const m = s % 60
            if (m !== 0) return null // label seulement aux heures pleines
            const h = Math.floor(s / 60)
            return (
              <text key={si} x={labelW + si * (cellSize + cellGap) + cellSize / 2} y={totalH - 4}
                textAnchor="middle" fontSize="9" fill="var(--muted)">{h}h</text>
            )
          })}
          {DAYS.map((day, di) => (
            <g key={day}>
              <text x={labelW - 4} y={di * (cellSize + cellGap) + cellSize / 2 + 4}
                textAnchor="end" fontSize="10" fill="var(--muted)">{day}</text>
              {heatmap.grid[di].map((v, si) => {
                const s = heatmap.slots[si]
                const h = Math.floor(s / 60)
                const m = s % 60
                return (
                  <rect key={si}
                    x={labelW + si * (cellSize + cellGap)}
                    y={di * (cellSize + cellGap)}
                    width={cellSize} height={cellSize} rx="2"
                    fill={cellColor(v)}>
                    <title>{day} {h}h{m > 0 ? String(m).padStart(2,'0') : ''} — {v} réservation{v !== 1 ? 's' : ''}</title>
                  </rect>
                )
              })}
            </g>
          ))}
        </svg>
      </div>
    )
  }


  return (
    <div>
      {/* Header */}
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
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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

      <SportFilterBar value={sportFilter} onChange={setSportFilter} style={{ marginBottom: '20px' }} />

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

          {/* Revenus par sport + par catégorie */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Revenus par sport</h2>
              {[
                { key: 'padel', label: 'Padel', col: sportColor('padel') },
                { key: 'badminton', label: 'Badminton', col: sportColor('badminton') },
                { key: 'commun', label: 'Commun / non lié', col: sportColor(null) },
              ].map(row => {
                const val = data.revenueBySport[row.key] || 0
                const pct = data.revenue > 0 ? Math.round((val / data.revenue) * 100) : 0
                if (val === 0) return null
                return (
                  <div key={row.key} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: row.col.text, fontWeight: 600 }}>{row.label}</span>
                      <span style={{ color: 'var(--muted)' }}>{fmt(val)} · {pct}%</span>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ background: row.col.border, width: pct + '%', height: '100%' }} />
                    </div>
                  </div>
                )
              })}
              {data.revenue === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucun revenu sur la période.</div>}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Revenus par catégorie</h2>
              {Object.entries(data.revenueByCategory).sort((a, b) => b[1] - a[1]).map(([label, val]) => {
                const pct = data.revenue > 0 ? Math.round((val / data.revenue) * 100) : 0
                return (
                  <div key={label} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
                      <span style={{ color: 'var(--muted)' }}>{fmt(val)} · {pct}%</span>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--brand)', width: pct + '%', height: '100%' }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(data.revenueByCategory).length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucun revenu sur la période.</div>}
            </div>
          </div>

          {/* Graphique revenus */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
              Revenus par jour
            </h2>
            <RevenueChart byDay={data.revenueByDay} from={data.from} to={data.to} />
          </div>

          {/* Heatmap horaire */}
          {(() => {
            const hm = computeHeatmap(data.allBookings, heatmapWeekOffset)
            return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                  <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>Affluence — jour & heure</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setHeatmapWeekOffset(o => o - 1)}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '14px' }}>‹</button>
                    <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600, minWidth: '90px', textAlign: 'center' }}>
                      S{hm.week} — {hm.year}
                    </span>
                    <button onClick={() => setHeatmapWeekOffset(o => Math.min(o + 1, 0))}
                      disabled={heatmapWeekOffset >= 0}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', cursor: heatmapWeekOffset >= 0 ? 'default' : 'pointer', color: heatmapWeekOffset >= 0 ? 'var(--muted)' : 'var(--text)', fontSize: '14px' }}>›</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span>🕐 Créneau de pointe : <strong style={{ color: 'var(--text)' }}>{hm.peakHour}</strong></span>
                  <span>Semaine : <strong style={{ color: 'var(--text)' }}>{hm.weekdayHours}</strong></span>
                  <span>Week-end : <strong style={{ color: 'var(--text)' }}>{hm.weekendHours}</strong></span>
                </div>
                <HeatmapChart heatmap={hm} />
              </div>
            )
          })()}

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

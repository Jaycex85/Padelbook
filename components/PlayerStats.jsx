'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

export default function PlayerStats({ userId }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('booking_players')
        .select('team, booking:bookings(id, starts_at, court:courts(name), match_results(sets, winning_team))')
        .eq('player_id', userId)
        .not('team', 'is', null)

      const matches = (data || [])
        .filter(r => r.booking?.match_results?.length > 0)
        .map(r => ({
          team: r.team,
          startsAt: r.booking.starts_at,
          courtName: r.booking.court?.name,
          ...r.booking.match_results[0],
        }))
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))

      let wins = 0, losses = 0, setsWon = 0, setsLost = 0
      matches.forEach(m => {
        const won = m.team === m.winning_team
        if (won) wins++; else losses++
        ;(m.sets || []).forEach(s => {
          const my = m.team === 1 ? s.team1 : s.team2
          const opp = m.team === 1 ? s.team2 : s.team1
          if (my > opp) setsWon++; else if (opp > my) setsLost++
        })
      })

      setStats({
        played: matches.length,
        wins, losses,
        winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
        setsWon, setsLost,
        recent: matches.slice(0, 5),
      })
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading || !stats) return null
  if (stats.played === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>🎾 Statistiques</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Aucun match enregistré pour l'instant.</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>🎾 Statistiques</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700 }}>{stats.played}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Matchs</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand-light)' }}>{stats.wins}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Victoires</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--red)' }}>{stats.losses}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Défaites</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700 }}>{stats.winRate}%</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Taux victoire</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', width: '50px' }}>Sets</div>
        <div style={{ flex: 1, height: '8px', borderRadius: '99px', overflow: 'hidden', display: 'flex', background: 'var(--surface2)' }}>
          <div style={{ width: (stats.setsWon / Math.max(1, stats.setsWon + stats.setsLost) * 100) + '%', background: 'var(--brand)' }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{stats.setsWon}-{stats.setsLost}</div>
      </div>

      {stats.recent.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>Derniers matchs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stats.recent.map((m, i) => {
              const won = m.team === m.winning_team
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '8px 10px', background: 'var(--surface2)', borderRadius: '8px' }}>
                  <span style={{ color: won ? 'var(--brand-light)' : 'var(--red)', fontWeight: 600, flexShrink: 0 }}>{won ? 'V' : 'D'}</span>
                  <span style={{ flex: 1, textAlign: 'center', color: 'var(--text)' }}>
                    {m.sets.map((s, j) => <span key={j} style={{ marginRight: '6px' }}>{s.team1}-{s.team2}</span>)}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', flexShrink: 0 }}>
                    {new Date(m.startsAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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

      // 1. Mes lignes booking_players avec équipe assignée
      const { data: bpRows } = await supabase
        .from('booking_players')
        .select('id, team, booking_id')
        .eq('player_id', userId)
        .not('team', 'is', null)

      if (!bpRows || bpRows.length === 0) {
        setStats({ played: 0, wins: 0, losses: 0, winRate: 0, setsWon: 0, setsLost: 0, recent: [] })
        setLoading(false)
        return
      }

      const bookingIds = bpRows.map(r => r.booking_id)

      // 2. Les bookings correspondants
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, starts_at, court:courts(name)')
        .in('id', bookingIds)

      // 3. Les résultats de match
      const { data: results } = await supabase
        .from('match_results')
        .select('booking_id, sets, winning_team')
        .in('booking_id', bookingIds)

      // Assembler
      const bookingMap = {}
      ;(bookings || []).forEach(b => { bookingMap[b.id] = b })
      const resultMap = {}
      ;(results || []).forEach(r => { resultMap[r.booking_id] = r })

      const matches = bpRows
        .filter(r => resultMap[r.booking_id])
        .map(r => ({
          team: r.team,
          startsAt: bookingMap[r.booking_id]?.starts_at,
          courtName: bookingMap[r.booking_id]?.court?.name,
          sets: resultMap[r.booking_id].sets,
          winning_team: resultMap[r.booking_id].winning_team,
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
        recent: matches,
      })
      setLoading(false)
    }
    load()
  }, [userId])

  const [showAll, setShowAll] = useState(false)
  const [expandedMatch, setExpandedMatch] = useState(null)
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
            {(showAll ? stats.recent : stats.recent.slice(0, 3)).map((m, i) => {
              const won = m.team === m.winning_team
              const isExpanded = expandedMatch === i
              return (
                <div key={i}>
                  <div onClick={() => setExpandedMatch(isExpanded ? null : i)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '8px 10px', background: 'var(--surface2)', borderRadius: isExpanded ? '8px 8px 0 0' : '8px', cursor: 'pointer' }}>
                    <span style={{ color: won ? 'var(--brand-light)' : 'var(--red)', fontWeight: 700, flexShrink: 0, width: '14px' }}>{won ? 'V' : 'D'}</span>
                    <span style={{ flex: 1, textAlign: 'center', color: 'var(--text)' }}>
                      {m.sets.map((s, j) => (
                        <span key={j} style={{ marginRight: '6px' }}>
                          {m.team === 1 ? s.team1 : s.team2}<span style={{ color: 'var(--muted)' }}>-</span>{m.team === 1 ? s.team2 : s.team1}
                          {s.tiebreak && <sup style={{ fontSize: '8px', color: 'var(--muted)' }}>TB</sup>}
                        </span>
                      ))}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', flexShrink: 0 }}>
                      {new Date(m.startsAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '10px', marginLeft: '6px' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px', fontSize: '12px' }}>
                      <div style={{ color: 'var(--muted)', marginBottom: '6px' }}>
                        🏟️ {m.courtName || 'Terrain'} · {new Date(m.startsAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })}
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {m.sets.map((s, j) => (
                          <div key={j} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '2px' }}>Set {j + 1}{s.tiebreak ? ' (TB)' : ''}</div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: 'var(--text)' }}>
                              <span style={{ color: (m.team === 1 ? s.team1 : s.team2) > (m.team === 1 ? s.team2 : s.team1) ? 'var(--brand-light)' : 'var(--red)' }}>
                                {m.team === 1 ? s.team1 : s.team2}
                              </span>
                              <span style={{ color: 'var(--muted)', margin: '0 3px' }}>-</span>
                              <span>{m.team === 1 ? s.team2 : s.team1}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {stats.recent.length > 3 && (
            <button onClick={() => { setShowAll(!showAll); setExpandedMatch(null) }}
              style={{ marginTop: '8px', width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
              {showAll ? 'Réduire' : 'Voir tout l\'historique (' + stats.recent.length + ' matchs)'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

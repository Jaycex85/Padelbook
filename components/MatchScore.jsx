'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function MatchScore({ booking, userId, isAdmin, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teams, setTeams] = useState(() => {
    const init = {}
    ;(booking.players || []).forEach((p, i) => { init[p.id] = p.team || (i % 2 === 0 ? 1 : 2) })
    return init
  })
  const [sets, setSets] = useState(() => {
    const existing = booking.match_results?.[0]?.sets
    return existing && existing.length > 0 ? existing : [{ team1: '', team2: '', tiebreak: false }]
  })
  const supabase = createClient()

  const players = booking.players || []
  const result = booking.match_results?.[0]
  const canEdit = isAdmin || players.some(p => p.player_id === userId)

  function memberName(p) {
    if (p.guest_name) return p.guest_name + ' (invité)'
    const prof = p.profile
    return prof?.first_name ? prof.first_name + (prof.last_name ? ' ' + prof.last_name[0] + '.' : '') : (prof?.email?.split('@')[0] || 'Joueur')
  }

  function updateSet(i, field, value) {
    setSets(s => s.map((set, idx) => idx === i ? { ...set, [field]: value } : set))
  }
  function addSet() {
    setSets(s => [...s, { team1: '', team2: '', tiebreak: false }])
  }
  function removeSet(i) {
    setSets(s => s.filter((_, idx) => idx !== i))
  }

  function computeWinner(setsData) {
    let t1 = 0, t2 = 0
    setsData.forEach(s => {
      const a = parseInt(s.team1), b = parseInt(s.team2)
      if (isNaN(a) || isNaN(b)) return
      if (a > b) t1++; else if (b > a) t2++
    })
    return t1 >= t2 ? 1 : 2
  }

  async function handleSave() {
    const validSets = sets.filter(s => s.team1 !== '' && s.team2 !== '')
    if (validSets.length === 0) return
    setSaving(true)

    // Sauver l'équipe de chaque joueur
    for (const p of players) {
      await supabase.from('booking_players').update({ team: teams[p.id] }).eq('id', p.id)
    }

    const cleanSets = validSets.map(s => ({ team1: parseInt(s.team1), team2: parseInt(s.team2), tiebreak: !!s.tiebreak }))
    const winning_team = computeWinner(cleanSets)

    if (result) {
      await supabase.from('match_results').update({ sets: cleanSets, winning_team }).eq('id', result.id)
    } else {
      await supabase.from('match_results').insert({ booking_id: booking.id, sets: cleanSets, winning_team, recorded_by: userId })
    }

    setSaving(false)
    setOpen(false)
    onUpdate && onUpdate()
  }

  const team1Players = players.filter(p => teams[p.id] === 1)
  const team2Players = players.filter(p => teams[p.id] === 2)

  if (!canEdit && !result) return null

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
      {result && !open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>🏆</span>
            {result.sets.map((s, i) => (
              <span key={i} style={{ fontSize: '13px', fontFamily: "'Syne',sans-serif", fontWeight: 600, color: 'var(--text)' }}>
                {s.team1}-{s.team2}{s.tiebreak ? <sup style={{ fontSize: '9px' }}>TB</sup> : ''}
              </span>
            ))}
          </div>
          {canEdit && (
            <button onClick={() => setOpen(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
              Modifier
            </button>
          )}
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          🎾 Enregistrer le score
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>Équipes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
                  <span>{memberName(p)}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2].map(t => (
                      <button key={t} onClick={() => setTeams(prev => ({ ...prev, [p.id]: t }))}
                        style={{ background: teams[p.id] === t ? 'var(--brand)' : 'var(--surface2)', color: teams[p.id] === t ? '#fff' : 'var(--muted)', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                        Équipe {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>Score par set</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sets.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', width: '34px' }}>Set {i + 1}</span>
                  <input type="number" min="0" max="20" value={s.team1} onChange={e => updateSet(i, 'team1', e.target.value)}
                    style={{ width: '44px', textAlign: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', color: 'var(--text)', fontSize: '13px' }} />
                  <span style={{ color: 'var(--muted)' }}>-</span>
                  <input type="number" min="0" max="20" value={s.team2} onChange={e => updateSet(i, 'team2', e.target.value)}
                    style={{ width: '44px', textAlign: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', color: 'var(--text)', fontSize: '13px' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--muted)', marginLeft: '4px' }}>
                    <input type="checkbox" checked={s.tiebreak} onChange={e => updateSet(i, 'tiebreak', e.target.checked)} /> TB
                  </label>
                  {sets.length > 1 && (
                    <button onClick={() => removeSet(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>✕</button>
                  )}
                </div>
              ))}
              {sets.length < 5 && (
                <button onClick={addSet} style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                  + Set
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} style={{ background: 'var(--brand)', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement...' : 'Valider le score'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

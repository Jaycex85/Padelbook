'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DURATIONS = [60, 90, 120]

export default function AdminSchedulePage() {
  const [courts, setCourts] = useState([])
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Formulaires
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [slotForm, setSlotForm] = useState({ day_of_week: 0, start_time: '09:00', duration_minutes: 90 })

  const [showCopyForm, setShowCopyForm] = useState(false)
  const [copySourceDay, setCopySourceDay] = useState(null)
  const [copyTargetDays, setCopyTargetDays] = useState([])

  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockMode, setBlockMode] = useState('simple') // 'simple' | 'recurring'
  const [blockForm, setBlockForm] = useState({ label: '', reason: 'other', starts_at: '', ends_at: '', all_courts: false, court_id: null })
  const [recurringForm, setRecurringForm] = useState({
    label: '', reason: 'other',
    days_of_week: [], time_from: '09:00', time_to: '20:00',
    date_from: '', date_to: '',
    court_ids: [], all_courts: true,
  })

  async function loadCourts() {
    const { data } = await supabase.from('courts').select('id, name').eq('status', 'active').order('sort_order')
    setCourts(data || [])
    if (data && data.length > 0 && !selectedCourt) setSelectedCourt(data[0].id)
    setLoading(false)
  }

  async function loadSchedule(courtId) {
    const { data } = await supabase.from('weekly_schedule').select('*').eq('court_id', courtId).order('day_of_week').order('start_time')
    setSchedule(data || [])
  }

  async function loadBlocks() {
    const { data } = await supabase.from('blocks').select('*, court:courts(name)').gte('ends_at', new Date().toISOString()).order('starts_at')
    setBlocks(data || [])
  }

  useEffect(() => { loadCourts(); loadBlocks() }, [])
  useEffect(() => { if (selectedCourt) loadSchedule(selectedCourt) }, [selectedCourt])

  async function addSlot() {
    setSaving(true)
    await supabase.from('weekly_schedule').insert({ ...slotForm, court_id: selectedCourt, is_active: true })
    setSaving(false)
    setShowSlotForm(false)
    loadSchedule(selectedCourt)
  }

  async function removeSlot(id) {
    await supabase.from('weekly_schedule').delete().eq('id', id)
    loadSchedule(selectedCourt)
  }

  // ─── Copier un jour vers d'autres jours ───
  function openCopyForm(dayIndex) {
    setCopySourceDay(dayIndex)
    setCopyTargetDays([])
    setShowCopyForm(true)
  }

  function toggleCopyTarget(day) {
    setCopyTargetDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
  }

  async function handleCopy() {
    if (copyTargetDays.length === 0) return
    setSaving(true)
    const sourceSlots = schedule.filter(s => s.day_of_week === copySourceDay)

    // Supprimer les créneaux existants des jours cibles, puis recréer
    for (const targetDay of copyTargetDays) {
      await supabase.from('weekly_schedule').delete().eq('court_id', selectedCourt).eq('day_of_week', targetDay)
      const inserts = sourceSlots.map(s => ({
        court_id: selectedCourt,
        day_of_week: targetDay,
        start_time: s.start_time,
        duration_minutes: s.duration_minutes,
        is_active: true,
      }))
      if (inserts.length > 0) {
        await supabase.from('weekly_schedule').insert(inserts)
      }
    }
    setSaving(false)
    setShowCopyForm(false)
    loadSchedule(selectedCourt)
  }

  // ─── Bloc simple (1 terrain, 1 plage) ───
  async function addBlock() {
    if (!blockForm.starts_at || !blockForm.ends_at) return
    if (!blockForm.all_courts && !blockForm.court_id) return
    setSaving(true)
    const payload = {
      label: blockForm.label,
      reason: blockForm.reason,
      starts_at: blockForm.starts_at,
      ends_at: blockForm.ends_at,
      all_courts: blockForm.all_courts,
      court_id: blockForm.all_courts ? null : blockForm.court_id,
    }
    const { error } = await supabase.from('blocks').insert(payload)
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    setSaving(false)
    setShowBlockForm(false)
    setBlockForm({ label: '', reason: 'other', starts_at: '', ends_at: '', all_courts: false, court_id: null })
    loadBlocks()
  }

  // ─── Bloc récurrent (multi-jours x multi-terrains x plage horaire, sur une période) ───
  function toggleRecurringDay(day) {
    setRecurringForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day) ? f.days_of_week.filter(d => d !== day) : [...f.days_of_week, day]
    }))
  }

  function toggleRecurringCourt(courtId) {
    setRecurringForm(f => ({
      ...f,
      court_ids: f.court_ids.includes(courtId) ? f.court_ids.filter(c => c !== courtId) : [...f.court_ids, courtId]
    }))
  }

  async function addRecurringBlock() {
    if (recurringForm.days_of_week.length === 0 || !recurringForm.date_from || !recurringForm.date_to) return
    if (!recurringForm.all_courts && recurringForm.court_ids.length === 0) return

    setSaving(true)
    const targetCourts = recurringForm.all_courts ? courts.map(c => c.id) : recurringForm.court_ids

    const start = new Date(recurringForm.date_from + 'T00:00:00')
    const end = new Date(recurringForm.date_to + 'T00:00:00')
    const inserts = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const jsDay = d.getDay()
      const dow = jsDay === 0 ? 6 : jsDay - 1 // 0=Lun
      if (!recurringForm.days_of_week.includes(dow)) continue

      const dateStr = d.toISOString().split('T')[0]
      const startsAt = dateStr + 'T' + recurringForm.time_from + ':00'
      const endsAt = dateStr + 'T' + recurringForm.time_to + ':00'

      for (const courtId of targetCourts) {
        inserts.push({
          court_id: courtId,
          reason: recurringForm.reason,
          label: recurringForm.label,
          starts_at: startsAt,
          ends_at: endsAt,
          all_courts: false,
        })
      }
    }

    if (inserts.length > 0) {
      await supabase.from('blocks').insert(inserts)
    }
    setSaving(false)
    setShowBlockForm(false)
    setRecurringForm({ label: '', reason: 'other', days_of_week: [], time_from: '09:00', time_to: '20:00', date_from: '', date_to: '', court_ids: [], all_courts: true })
    loadBlocks()
  }

  async function duplicateBlock(block) {
    const { id, created_at, court, ...rest } = block
    await supabase.from('blocks').insert(rest)
    loadBlocks()
  }

  async function removeBlock(id) {
    await supabase.from('blocks').delete().eq('id', id)
    loadBlocks()
  }

  const byDay = DAYS.map((_, i) => schedule.filter(s => s.day_of_week === i))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendrier</h1>
          <p className="page-sub">Semaine type par terrain + blocs ponctuels</p>
        </div>
      </div>

      {/* Sélecteur terrain */}
      <div className="court-tabs">
        {courts.map(c => (
          <button key={c.id} className={'court-tab' + (selectedCourt === c.id ? ' active' : '')} onClick={() => setSelectedCourt(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Semaine type */}
      <div className="section-header">
        <h2 className="section-title">Semaine type</h2>
        <button className="btn-primary btn-sm" onClick={() => setShowSlotForm(true)}>+ Ajouter un créneau</button>
      </div>

      <div className="week-grid">
        {DAYS.map((day, i) => (
          <div key={i} className="day-col">
            <div className="day-col-header">
              <span className="day-header">{DAYS_SHORT[i]}</span>
              {byDay[i].length > 0 && (
                <button className="copy-btn" onClick={() => openCopyForm(i)} title={'Copier ' + day + ' vers d\'autres jours'}>⎘</button>
              )}
            </div>
            {byDay[i].length === 0 ? (
              <div className="day-empty">—</div>
            ) : (
              byDay[i].map(slot => (
                <div key={slot.id} className={'slot-chip' + (slot.is_active ? '' : ' inactive')}>
                  <span>{slot.start_time.substring(0,5)}</span>
                  <span className="slot-dur">{slot.duration_minutes}min</span>
                  <button className="slot-remove" onClick={() => removeSlot(slot.id)}>✕</button>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* Blocs ponctuels */}
      <div className="section-header" style={{marginTop: '32px'}}>
        <h2 className="section-title">Blocs ponctuels</h2>
        <button className="btn-primary btn-sm" onClick={() => { setBlockMode('simple'); setShowBlockForm(true) }}>+ Ajouter un bloc</button>
      </div>

      {blocks.length === 0 ? (
        <p className="text-muted" style={{fontSize:'14px'}}>Aucun bloc planifié.</p>
      ) : (
        <div className="blocks-list">
          {blocks.map(block => (
            <div key={block.id} className="block-row">
              <div className="block-reason">{block.reason}</div>
              <div className="block-label">{block.label || 'Sans titre'}</div>
              <div className="block-dates">
                {new Date(block.starts_at).toLocaleDateString('fr-BE')} {new Date(block.starts_at).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})} → {new Date(block.ends_at).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}
              </div>
              {block.all_courts ? <span className="badge badge-amber">Tous terrains</span> : block.court?.name && <span className="badge badge-muted">{block.court.name}</span>}
              <button className="btn-icon" onClick={() => duplicateBlock(block)} title="Dupliquer">⎘</button>
              <button className="btn-icon" onClick={() => removeBlock(block.id)} title="Supprimer">🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal créneau simple */}
      {showSlotForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSlotForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nouveau créneau</h2>
              <button className="modal-close" onClick={() => setShowSlotForm(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Jour</label>
              <select className="form-input" value={slotForm.day_of_week} onChange={e => setSlotForm({...slotForm, day_of_week: parseInt(e.target.value)})}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Heure de début</label>
                <input type="time" className="form-input" value={slotForm.start_time} onChange={e => setSlotForm({...slotForm, start_time: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Durée</label>
                <select className="form-input" value={slotForm.duration_minutes} onChange={e => setSlotForm({...slotForm, duration_minutes: parseInt(e.target.value)})}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowSlotForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={addSlot} disabled={saving}>{saving ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal copier jour */}
      {showCopyForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCopyForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Copier {DAYS[copySourceDay]}</h2>
              <button className="modal-close" onClick={() => setShowCopyForm(false)}>✕</button>
            </div>
            <p style={{fontSize:'13px', color:'var(--muted)', marginBottom:'16px'}}>
              Les {byDay[copySourceDay]?.length || 0} créneau(x) de {DAYS[copySourceDay]} seront copiés vers les jours sélectionnés (remplace leur contenu existant).
            </p>
            <div className="form-group">
              <label className="form-label">Copier vers</label>
              <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                {DAYS.map((d, i) => i !== copySourceDay && (
                  <button key={i} className={'tag-btn' + (copyTargetDays.includes(i) ? ' active' : '')} onClick={() => toggleCopyTarget(i)}>
                    {DAYS_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowCopyForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleCopy} disabled={saving || copyTargetDays.length === 0}>
                {saving ? 'Copie...' : 'Copier vers ' + copyTargetDays.length + ' jour(s)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bloc (simple ou récurrent) */}
      {showBlockForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBlockForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Nouveau bloc</h2>
              <button className="modal-close" onClick={() => setShowBlockForm(false)}>✕</button>
            </div>

            {/* Switch mode */}
            <div style={{display:'flex', gap:'6px', marginBottom:'18px'}}>
              <button className={'mode-tab' + (blockMode === 'simple' ? ' active' : '')} onClick={() => setBlockMode('simple')}>Ponctuel</button>
              <button className={'mode-tab' + (blockMode === 'recurring' ? ' active' : '')} onClick={() => setBlockMode('recurring')}>Récurrent (multi-jours / terrains)</button>
            </div>

            {blockMode === 'simple' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Raison</label>
                  <select className="form-input" value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})}>
                    <option value="tournament">Tournoi</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="event">Événement</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input className="form-input" value={blockForm.label} onChange={e => setBlockForm({...blockForm, label: e.target.value})} placeholder="Ex: Tournoi printemps 2026" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Début</label>
                    <input type="datetime-local" className="form-input" value={blockForm.starts_at} onChange={e => setBlockForm({...blockForm, starts_at: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fin</label>
                    <input type="datetime-local" className="form-input" value={blockForm.ends_at} onChange={e => setBlockForm({...blockForm, ends_at: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Terrain(s) concerné(s)</label>
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px'}}>
                    <button
                      onClick={() => setBlockForm({...blockForm, all_courts: true, court_id: null})}
                      style={{background: blockForm.all_courts ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (blockForm.all_courts ? 'var(--brand)' : 'var(--border)'), color: blockForm.all_courts ? 'var(--brand-light)' : 'var(--muted)', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', cursor:'pointer'}}>
                      Tous les terrains
                    </button>
                    {courts.map(c => (
                      <button key={c.id}
                        onClick={() => setBlockForm({...blockForm, all_courts: false, court_id: c.id})}
                        style={{background: !blockForm.all_courts && blockForm.court_id === c.id ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (!blockForm.all_courts && blockForm.court_id === c.id ? 'var(--brand)' : 'var(--border)'), color: !blockForm.all_courts && blockForm.court_id === c.id ? 'var(--brand-light)' : 'var(--muted)', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', cursor:'pointer'}}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-outline" onClick={() => setShowBlockForm(false)}>Annuler</button>
                  <button className="btn-primary" onClick={addBlock} disabled={saving || !blockForm.starts_at || !blockForm.ends_at || (!blockForm.all_courts && !blockForm.court_id)}>
                    {saving ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'14px'}}>
                  Génère automatiquement un bloc pour chaque jour sélectionné, sur la période et les terrains choisis.
                </p>
                <div className="form-group">
                  <label className="form-label">Raison</label>
                  <select className="form-input" value={recurringForm.reason} onChange={e => setRecurringForm({...recurringForm, reason: e.target.value})}>
                    <option value="tournament">Tournoi</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="event">Événement</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input className="form-input" value={recurringForm.label} onChange={e => setRecurringForm({...recurringForm, label: e.target.value})} placeholder="Ex: Maintenance hebdo" />
                </div>

                <div className="form-group">
                  <label className="form-label">Jours concernés</label>
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                    {DAYS_SHORT.map((d, i) => (
                      <button key={i} className={'tag-btn' + (recurringForm.days_of_week.includes(i) ? ' active' : '')} onClick={() => toggleRecurringDay(i)}>{d}</button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Heure de</label>
                    <input type="time" className="form-input" value={recurringForm.time_from} onChange={e => setRecurringForm({...recurringForm, time_from: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure à</label>
                    <input type="time" className="form-input" value={recurringForm.time_to} onChange={e => setRecurringForm({...recurringForm, time_to: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Du (date)</label>
                    <input type="date" className="form-input" value={recurringForm.date_from} onChange={e => setRecurringForm({...recurringForm, date_from: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Au (date)</label>
                    <input type="date" className="form-input" value={recurringForm.date_to} onChange={e => setRecurringForm({...recurringForm, date_to: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Terrains concernés</label>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'8px'}}>
                    <button className={'tag-btn' + (recurringForm.all_courts ? ' active' : '')} onClick={() => setRecurringForm({...recurringForm, all_courts: true})}>Tous les terrains</button>
                    <button className={'tag-btn' + (!recurringForm.all_courts ? ' active' : '')} onClick={() => setRecurringForm({...recurringForm, all_courts: false})}>Sélection</button>
                  </div>
                  {!recurringForm.all_courts && (
                    <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                      {courts.map(c => (
                        <button key={c.id} className={'tag-btn' + (recurringForm.court_ids.includes(c.id) ? ' active' : '')} onClick={() => toggleRecurringCourt(c.id)}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {recurringForm.days_of_week.length > 0 && recurringForm.date_from && recurringForm.date_to && (
                  <p style={{fontSize:'12px', color:'var(--brand-light)', background:'var(--brand-dim)', padding:'8px 12px', borderRadius:'8px', marginBottom:'14px'}}>
                    ≈ {estimateCount(recurringForm, courts)} bloc(s) seront créés
                  </p>
                )}

                <div className="modal-footer">
                  <button className="btn-outline" onClick={() => setShowBlockForm(false)}>Annuler</button>
                  <button className="btn-primary" onClick={addRecurringBlock}
                    disabled={saving || recurringForm.days_of_week.length === 0 || !recurringForm.date_from || !recurringForm.date_to || (!recurringForm.all_courts && recurringForm.court_ids.length === 0)}>
                    {saving ? 'Création...' : 'Générer les blocs'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
        .page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .court-tabs { display:flex; gap:6px; margin-bottom:24px; flex-wrap:wrap; }
        .court-tab { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 16px; font-size:13px; cursor:pointer; color:var(--muted); transition:all .15s; }
        .court-tab.active { border-color:var(--brand); color:var(--brand-light); background:var(--brand-dim); }
        .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
        .section-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; }
        .week-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; overflow-x:auto; }
        @media (max-width:767px) { .week-grid { grid-template-columns:repeat(4,1fr); } }
        .day-col { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px; }
        .day-col-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .day-header { font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; }
        .copy-btn { background:none; border:1px solid var(--border); border-radius:5px; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted); font-size:11px; padding:0; }
        .copy-btn:hover { border-color:var(--brand); color:var(--brand-light); }
        .day-empty { font-size:12px; color:var(--border); text-align:center; padding:8px 0; }
        .slot-chip { background:var(--brand-dim); border:1px solid rgba(124,58,237,0.25); border-radius:6px; padding:5px 8px; margin-bottom:4px; font-size:12px; color:var(--brand-light); display:flex; align-items:center; gap:4px; }
        .slot-chip.inactive { opacity:0.4; }
        .slot-dur { color:var(--muted); font-size:10px; flex:1; }
        .slot-remove { background:none; border:none; color:var(--muted); cursor:pointer; font-size:10px; padding:0; }
        .slot-remove:hover { color:var(--red); }
        .blocks-list { display:flex; flex-direction:column; gap:8px; }
        .block-row { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .block-reason { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--amber); font-weight:500; }
        .block-label { font-size:14px; font-weight:500; flex:1; min-width: 120px; }
        .block-dates { font-size:12px; color:var(--muted); }
        .badge { font-size:11px; padding:2px 8px; border-radius:99px; font-weight:500; }
        .badge-amber { background:rgba(252,211,77,0.1); color:var(--amber); }
        .badge-muted { background:rgba(139,148,158,0.12); color:var(--muted); }
        .btn-primary { background:var(--brand); color:#fff; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; font-family:'Syne',sans-serif; }
        .btn-primary:hover { background:#6D28D9; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-sm { padding:7px 14px; font-size:13px; }
        .btn-outline { background:none; border:1px solid var(--border); color:var(--muted); border-radius:8px; padding:10px 20px; font-size:14px; cursor:pointer; }
        .btn-icon { background:none; border:1px solid var(--border); border-radius:8px; padding:5px 9px; cursor:pointer; font-size:14px; transition:all .15s; }
        .btn-icon:hover { border-color:var(--brand); color: var(--brand-light); }
        .mode-tab { flex:1; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px; font-size:13px; cursor:pointer; color:var(--muted); transition:all .15s; }
        .mode-tab.active { border-color:var(--brand); color:var(--brand-light); background:var(--brand-dim); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; padding:16px; }
        .modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:24px; width:100%; max-width:460px; max-height: 88vh; overflow-y: auto; }
        .modal-lg { max-width: 560px; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .modal-header h2 { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; }
        .modal-close { background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer; }
        .modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
        .form-group { margin-bottom:14px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-label { display:block; font-size:11px; font-weight:500; color:var(--muted); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.3px; }
        .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-size:14px; font-family:'Inter',sans-serif; }
        .form-input:focus { outline:none; border-color:var(--brand); }
        .tag-btn { background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer; color:var(--muted); transition:all .15s; }
        .tag-btn.active { border-color:var(--brand); color:var(--brand-light); background:var(--brand-dim); }
        .text-muted { color:var(--muted); }

        @media (max-width: 480px) {
          .modal { max-width: calc(100vw - 32px) !important; }
          .form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function estimateCount(form, courts) {
  if (!form.date_from || !form.date_to || form.days_of_week.length === 0) return 0
  const start = new Date(form.date_from + 'T00:00:00')
  const end = new Date(form.date_to + 'T00:00:00')
  let dayCount = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const jsDay = d.getDay()
    const dow = jsDay === 0 ? 6 : jsDay - 1
    if (form.days_of_week.includes(dow)) dayCount++
  }
  const courtCount = form.all_courts ? courts.length : form.court_ids.length
  return dayCount * courtCount
}

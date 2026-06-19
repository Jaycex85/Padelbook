'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DURATIONS = [60, 90, 120]

export default function AdminSchedulePage() {
  const [courts, setCourts] = useState([])
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [slotForm, setSlotForm] = useState({ day_of_week: 0, start_time: '09:00', duration_minutes: 90 })
  const [blockForm, setBlockForm] = useState({ label: '', reason: 'other', starts_at: '', ends_at: '', all_courts: false })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function loadCourts() {
    const { data } = await supabase.from('courts').select('id, name').eq('status', 'active').order('sort_order')
    setCourts(data || [])
    if (data && data.length > 0 && !selectedCourt) {
      setSelectedCourt(data[0].id)
    }
    setLoading(false)
  }

  async function loadSchedule(courtId) {
    const { data } = await supabase.from('weekly_schedule').select('*').eq('court_id', courtId).order('day_of_week').order('start_time')
    setSchedule(data || [])
  }

  async function loadBlocks() {
    const { data } = await supabase.from('blocks').select('*').gte('ends_at', new Date().toISOString()).order('starts_at')
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

  async function addBlock() {
    setSaving(true)
    const payload = { ...blockForm }
    if (blockForm.all_courts) { delete payload.court_id } else { payload.court_id = selectedCourt }
    await supabase.from('blocks').insert(payload)
    setSaving(false)
    setShowBlockForm(false)
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
            <div className="day-header">{day}</div>
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
        <button className="btn-primary btn-sm" onClick={() => setShowBlockForm(true)}>+ Ajouter un bloc</button>
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
                {new Date(block.starts_at).toLocaleDateString('fr-BE')} → {new Date(block.ends_at).toLocaleDateString('fr-BE')}
              </div>
              {block.all_courts && <span className="badge badge-amber">Tous terrains</span>}
              <button className="btn-icon" onClick={() => removeBlock(block.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal créneau */}
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
              <button className="btn-primary" onClick={addSlot} disabled={saving}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bloc */}
      {showBlockForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBlockForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nouveau bloc</h2>
              <button className="modal-close" onClick={() => setShowBlockForm(false)}>✕</button>
            </div>
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
            <div className="form-group" style={{display:'flex', alignItems:'center', gap:'10px'}}>
              <input type="checkbox" id="all_courts" checked={blockForm.all_courts} onChange={e => setBlockForm({...blockForm, all_courts: e.target.checked})} />
              <label htmlFor="all_courts" style={{fontSize:'14px', cursor:'pointer'}}>Bloquer tous les terrains</label>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowBlockForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={addBlock} disabled={saving || !blockForm.starts_at || !blockForm.ends_at}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
        .page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .court-tabs { display:flex; gap:6px; margin-bottom:24px; flex-wrap:wrap; }
        .court-tab { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 16px; font-size:13px; cursor:pointer; color:var(--muted); transition:all .15s; }
        .court-tab.active { border-color:var(--green); color:var(--green); background:rgba(74,222,128,0.08); }
        .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .section-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; }
        .week-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; overflow-x:auto; }
        @media (max-width:767px) { .week-grid { grid-template-columns:repeat(4,1fr); } }
        .day-col { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px; }
        .day-header { font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .day-empty { font-size:12px; color:var(--border); text-align:center; padding:8px 0; }
        .slot-chip { background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); border-radius:6px; padding:5px 8px; margin-bottom:4px; font-size:12px; color:var(--green); display:flex; align-items:center; gap:4px; }
        .slot-chip.inactive { opacity:0.4; }
        .slot-dur { color:var(--muted); font-size:10px; flex:1; }
        .slot-remove { background:none; border:none; color:var(--muted); cursor:pointer; font-size:10px; padding:0; }
        .slot-remove:hover { color:var(--red); }
        .blocks-list { display:flex; flex-direction:column; gap:8px; }
        .block-row { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .block-reason { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--amber); font-weight:500; }
        .block-label { font-size:14px; font-weight:500; flex:1; }
        .block-dates { font-size:12px; color:var(--muted); }
        .badge { font-size:11px; padding:2px 8px; border-radius:99px; font-weight:500; }
        .badge-amber { background:rgba(252,211,77,0.1); color:var(--amber); }
        .btn-primary { background:var(--green); color:#0D1117; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; font-family:'Syne',sans-serif; }
        .btn-primary:hover { background:#86efac; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-sm { padding:7px 14px; font-size:13px; }
        .btn-outline { background:none; border:1px solid var(--border); color:var(--muted); border-radius:8px; padding:10px 20px; font-size:14px; cursor:pointer; }
        .btn-icon { background:none; border:1px solid var(--border); border-radius:8px; padding:5px 9px; cursor:pointer; font-size:14px; transition:all .15s; }
        .btn-icon:hover { border-color:var(--red); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; padding:16px; }
        .modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:24px; width:100%; max-width:460px; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .modal-header h2 { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; }
        .modal-close { background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer; }
        .modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
        .form-group { margin-bottom:14px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-label { display:block; font-size:11px; font-weight:500; color:var(--muted); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.3px; }
        .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-size:14px; font-family:'Inter',sans-serif; }
        .form-input:focus { outline:none; border-color:var(--green); }
        .text-muted { color:var(--muted); }
      
        @media (max-width: 480px) {
          .modal { max-width: calc(100vw - 32px) !important; }
          .form-row { grid-template-columns: 1fr !important; }
        }
`}</style>
    </div>
  )
}

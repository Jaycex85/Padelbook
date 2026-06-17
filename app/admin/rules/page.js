'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WHO_LABELS = { all: 'Tout le monde', member: 'Membres uniquement', public: 'Public uniquement' }
const EFFECT_LABELS = { allow: '✓ Autoriser', deny: '✕ Bloquer' }

export default function AdminRulesPage() {
  const [rules, setRules] = useState([])
  const [courts, setCourts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', who: 'member', effect: 'allow', all_courts: true, court_id: null, days_of_week: [], time_from: '', time_to: '', date_from: '', date_to: '', priority: 0, is_active: true })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('access_rules').select('*, court:courts(name)').order('priority', { ascending: false }),
      supabase.from('courts').select('id, name').eq('status', 'active')
    ])
    setRules(r || [])
    setCourts(c || [])
  }

  useEffect(() => { load() }, [])

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d]
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      label: form.label,
      who: form.who,
      effect: form.effect,
      all_courts: form.all_courts,
      court_id: form.all_courts ? null : form.court_id,
      days_of_week: form.days_of_week.length > 0 ? form.days_of_week : null,
      time_from: form.time_from || null,
      time_to: form.time_to || null,
      date_from: form.date_from || null,
      date_to: form.date_to || null,
      priority: parseInt(form.priority),
      is_active: true,
    }
    await supabase.from('access_rules').insert(payload)
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function toggleRule(rule) {
    await supabase.from('access_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    load()
  }

  async function deleteRule(id) {
    await supabase.from('access_rules').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Règles d'accès</h1>
          <p className="page-sub">Les règles sont évaluées par priorité décroissante — la dernière règle qui s'applique gagne.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Ajouter une règle</button>
      </div>

      {rules.length === 0 ? (
        <div className="empty">Aucune règle configurée. Par défaut, tout le monde peut réserver.</div>
      ) : (
        <div className="rules-list">
          {rules.map(rule => (
            <div key={rule.id} className={'rule-row' + (rule.is_active ? '' : ' rule-inactive')}>
              <div className={'effect-badge ' + (rule.effect === 'allow' ? 'effect-allow' : 'effect-deny')}>
                {rule.effect === 'allow' ? '✓' : '✕'}
              </div>
              <div className="rule-info">
                <div className="rule-label">{rule.label || 'Sans titre'}</div>
                <div className="rule-meta">
                  <span className="badge badge-blue">{WHO_LABELS[rule.who]}</span>
                  {rule.all_courts ? <span className="badge badge-muted">Tous terrains</span> : <span className="badge badge-muted">{rule.court?.name}</span>}
                  {rule.days_of_week && <span className="badge badge-muted">{rule.days_of_week.map(d => DAYS[d]).join(', ')}</span>}
                  {rule.time_from && <span className="badge badge-muted">{rule.time_from.substring(0,5)} → {rule.time_to?.substring(0,5)}</span>}
                  {rule.date_from && <span className="badge badge-muted">{rule.date_from} → {rule.date_to}</span>}
                  <span className="priority-label">Priorité {rule.priority}</span>
                </div>
              </div>
              <div className="rule-actions">
                <button className={'toggle-btn' + (rule.is_active ? ' on' : '')} onClick={() => toggleRule(rule)}>
                  {rule.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button className="btn-icon" onClick={() => deleteRule(rule.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nouvelle règle</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Label (description)</label>
              <input className="form-input" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="Ex: Membres seulement le soir" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Qui ?</label>
                <select className="form-input" value={form.who} onChange={e => setForm({...form, who: e.target.value})}>
                  <option value="all">Tout le monde</option>
                  <option value="member">Membres uniquement</option>
                  <option value="public">Public uniquement</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Effet</label>
                <select className="form-input" value={form.effect} onChange={e => setForm({...form, effect: e.target.value})}>
                  <option value="allow">Autoriser</option>
                  <option value="deny">Bloquer</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Terrain concerné</label>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                <button className={'tag-btn' + (form.all_courts ? ' active' : '')} onClick={() => setForm({...form, all_courts: true})}>Tous</button>
                {courts.map(c => (
                  <button key={c.id} className={'tag-btn' + (!form.all_courts && form.court_id === c.id ? ' active' : '')} onClick={() => setForm({...form, all_courts: false, court_id: c.id})}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Jours (vide = tous)</label>
              <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                {DAYS.map((d, i) => (
                  <button key={i} className={'tag-btn' + (form.days_of_week.includes(i) ? ' active' : '')} onClick={() => toggleDay(i)}>{d}</button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Heure de (vide = toute la journée)</label>
                <input type="time" className="form-input" value={form.time_from} onChange={e => setForm({...form, time_from: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Heure à</label>
                <input type="time" className="form-input" value={form.time_to} onChange={e => setForm({...form, time_to: e.target.value})} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de (optionnel)</label>
                <input type="date" className="form-input" value={form.date_from} onChange={e => setForm({...form, date_from: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date à</label>
                <input type="date" className="form-input" value={form.date_to} onChange={e => setForm({...form, date_to: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Priorité (plus élevé = évalué en dernier)</label>
              <input type="number" className="form-input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} />
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
        .page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; max-width:480px; }
        .empty { text-align:center; padding:48px; color:var(--muted); font-size:14px; }
        .rules-list { display:flex; flex-direction:column; gap:8px; }
        .rule-row { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 16px; display:flex; align-items:flex-start; gap:12px; }
        .rule-inactive { opacity:0.45; }
        .effect-badge { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .effect-allow { background:rgba(74,222,128,0.12); color:var(--green); }
        .effect-deny { background:rgba(248,113,113,0.12); color:var(--red); }
        .rule-info { flex:1; min-width:0; }
        .rule-label { font-size:14px; font-weight:500; margin-bottom:6px; }
        .rule-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .badge { font-size:11px; padding:2px 8px; border-radius:99px; font-weight:500; }
        .badge-blue { background:rgba(96,165,250,0.1); color:#93C5FD; }
        .badge-muted { background:rgba(139,148,158,0.1); color:var(--muted); }
        .priority-label { font-size:11px; color:var(--muted); }
        .rule-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .toggle-btn { font-size:11px; padding:4px 10px; border-radius:99px; cursor:pointer; border:1px solid var(--border); background:none; color:var(--muted); transition:all .15s; }
        .toggle-btn.on { border-color:var(--green); color:var(--green); background:rgba(74,222,128,0.08); }
        .btn-icon { background:none; border:1px solid var(--border); border-radius:8px; padding:5px 9px; cursor:pointer; font-size:13px; }
        .btn-icon:hover { border-color:var(--red); }
        .btn-primary { background:var(--green); color:#0D1117; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; font-family:'Syne',sans-serif; }
        .btn-primary:hover { background:#86efac; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-outline { background:none; border:1px solid var(--border); color:var(--muted); border-radius:8px; padding:10px 20px; font-size:14px; cursor:pointer; }
        .tag-btn { background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer; color:var(--muted); transition:all .15s; }
        .tag-btn.active { border-color:var(--green); color:var(--green); background:rgba(74,222,128,0.08); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; padding:16px; }
        .modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:24px; width:100%; max-width:500px; max-height:90vh; overflow-y:auto; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .modal-header h2 { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; }
        .modal-close { background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer; }
        .modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
        .form-group { margin-bottom:14px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-label { display:block; font-size:11px; font-weight:500; color:var(--muted); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.3px; }
        .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-size:14px; font-family:'Inter',sans-serif; }
        .form-input:focus { outline:none; border-color:var(--green); }
      `}</style>
    </div>
  )
}

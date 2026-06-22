'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WHO_LABELS = { all: 'Tout le monde', member: 'Joueurs (ancien rôle)', public: 'Joueurs enregistrés', cotisant: 'Membres du club' }
const EFFECT_LABELS = { allow: '✓ Autoriser', deny: '✕ Bloquer' }

const EMPTY_FORM = {
  label: '', who: 'member', effect: 'allow', all_courts: true, court_id: null,
  days_of_week: [], time_from: '', time_to: '', date_from: '', date_to: '',
  priority: 0, is_active: true,
  max_concurrent_bookings: '', booking_window_days: '',
}

export default function AdminRulesPage() {
  const [rules, setRules] = useState([])
  const [courts, setCourts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
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
      max_concurrent_bookings: form.max_concurrent_bookings !== '' ? parseInt(form.max_concurrent_bookings) : null,
      booking_window_days: form.booking_window_days !== '' ? parseInt(form.booking_window_days) : null,
    }
    await supabase.from('access_rules').insert(payload)
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
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

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Règles d'accès</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px', maxWidth: '480px' }}>
            Une règle peut cumuler plusieurs effets : autoriser/bloquer, limiter le nombre de réservations simultanées, et/ou définir une fenêtre d'ouverture. Évaluées par priorité croissante — la dernière règle qui matche gagne pour chaque effet.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Ajouter une règle
        </button>
      </div>

      {rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>Aucune règle configurée. Par défaut, tout le monde peut réserver sans limite.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map(rule => (
            <div key={rule.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: rule.is_active ? 1 : 0.45 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0, marginTop: '2px', background: rule.effect === 'allow' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', color: rule.effect === 'allow' ? '#4ADE80' : 'var(--red)' }}>
                {rule.effect === 'allow' ? '✓' : '✕'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{rule.label || 'Sans titre'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: rule.who === 'cotisant' ? 'var(--brand-dim)' : 'rgba(96,165,250,0.1)', color: rule.who === 'cotisant' ? 'var(--brand-light)' : '#93C5FD' }}>{WHO_LABELS[rule.who]}</span>
                  {rule.all_courts ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>Tous terrains</span> : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.court?.name}</span>}
                  {rule.days_of_week && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.days_of_week.map(d => DAYS[d]).join(', ')}</span>}
                  {rule.time_from && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.time_from.substring(0,5)} → {rule.time_to?.substring(0,5)}</span>}
                  {rule.date_from && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.date_from} → {rule.date_to}</span>}
                  {rule.max_concurrent_bookings != null && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Max {rule.max_concurrent_bookings} résa simultanée{rule.max_concurrent_bookings > 1 ? 's' : ''}</span>}
                  {rule.booking_window_days != null && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Ouvre {rule.booking_window_days}j avant</span>}
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Priorité {rule.priority}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => toggleRule(rule)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', cursor: 'pointer', border: '1px solid ' + (rule.is_active ? 'var(--brand)' : 'var(--border)'), background: rule.is_active ? 'var(--brand-dim)' : 'none', color: rule.is_active ? 'var(--brand-light)' : 'var(--muted)' }}>
                  {rule.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>Nouvelle règle</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Label (description)</label>
              <input style={fieldStyle} value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="Ex: Membres cotisants — accès prioritaire" />
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Qui ?</label>
                <select style={fieldStyle} value={form.who} onChange={e => setForm({...form, who: e.target.value})}>
                  <option value="all">Tout le monde</option>
                  <option value="public">Joueurs enregistrés</option>
                  <option value="cotisant">Membres du club</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Effet allow/deny</label>
                <select style={fieldStyle} value={form.effect} onChange={e => setForm({...form, effect: e.target.value})}>
                  <option value="allow">Autoriser</option>
                  <option value="deny">Bloquer</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Terrain concerné</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setForm({...form, all_courts: true})} style={{ background: form.all_courts ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.all_courts ? 'var(--brand)' : 'var(--border)'), color: form.all_courts ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>Tous</button>
                {courts.map(c => (
                  <button key={c.id} onClick={() => setForm({...form, all_courts: false, court_id: c.id})} style={{ background: !form.all_courts && form.court_id === c.id ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (!form.all_courts && form.court_id === c.id ? 'var(--brand)' : 'var(--border)'), color: !form.all_courts && form.court_id === c.id ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Jours (vide = tous)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)} style={{ background: form.days_of_week.includes(i) ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.days_of_week.includes(i) ? 'var(--brand)' : 'var(--border)'), color: form.days_of_week.includes(i) ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>{d}</button>
                ))}
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Heure de (vide = toute la journée)</label>
                <input type="time" style={fieldStyle} value={form.time_from} onChange={e => setForm({...form, time_from: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Heure à</label>
                <input type="time" style={fieldStyle} value={form.time_to} onChange={e => setForm({...form, time_to: e.target.value})} />
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Date de (optionnel)</label>
                <input type="date" style={fieldStyle} value={form.date_from} onChange={e => setForm({...form, date_from: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Date à</label>
                <input type="date" style={fieldStyle} value={form.date_to} onChange={e => setForm({...form, date_to: e.target.value})} />
              </div>
            </div>

            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-light)', marginBottom: '10px' }}>⚙️ Contraintes avancées (optionnel)</div>
              <div className="form-row-responsive">
                <div>
                  <label style={labelStyle}>Max réservations simultanées (owner)</label>
                  <input type="number" min="0" style={fieldStyle} value={form.max_concurrent_bookings} onChange={e => setForm({...form, max_concurrent_bookings: e.target.value})} placeholder="Illimité" />
                </div>
                <div>
                  <label style={labelStyle}>Fenêtre d'ouverture (jours avant)</label>
                  <input type="number" min="0" style={fieldStyle} value={form.booking_window_days} onChange={e => setForm({...form, booking_window_days: e.target.value})} placeholder="Illimité" />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                Laisser vide = pas de contrainte de ce type pour cette règle. Ex: "Membre cotisant" + fenêtre 14j + max 3 résa.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Priorité (plus élevé = évalué en dernier, donc prioritaire)</label>
              <input type="number" style={fieldStyle} value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

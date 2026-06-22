'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const WHO_OPTIONS = [
  { value: 'all', label: 'Tout le monde' },
  { value: 'public', label: 'Joueurs enregistrés' },
  { value: 'cotisant', label: 'Membres du club' },
]

const WHO_LABELS = { all: 'Tout le monde', public: 'Joueurs enregistrés', cotisant: 'Membres du club', member: 'Joueurs (ancien rôle)' }

const RULE_TYPES = [
  {
    key: 'access',
    icon: '📅',
    label: 'Accès horaire',
    desc: 'Définit qui peut réserver, quels jours et à quelles heures.',
    fields: ['who', 'effect', 'days', 'time', 'date', 'courts'],
  },
  {
    key: 'quota',
    icon: '🔢',
    label: 'Quota de réservations',
    desc: "Limite le nombre de réservations actives simultanées en tant qu'organisateur.",
    fields: ['who', 'max_concurrent'],
  },
  {
    key: 'window',
    icon: '📆',
    label: "Fenêtre d'ouverture",
    desc: "Définit combien de jours à l'avance un profil peut réserver.",
    fields: ['who', 'window_days'],
  },
]

const EMPTY_FORM = {
  label: '',
  who: 'public',
  effect: 'allow',
  all_courts: true,
  court_id: null,
  days_of_week: [],
  time_from: '',
  time_to: '',
  date_from: '',
  date_to: '',
  priority: 0,
  max_concurrent_bookings: '',
  booking_window_days: '',
}

export default function AdminRulesPage() {
  const [rules, setRules] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ruleType, setRuleType] = useState(null) // 'access' | 'quota' | 'window'
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('access_rules').select('*, court:courts(name)').order('priority', { ascending: false }),
      supabase.from('courts').select('id, name').eq('status', 'active'),
    ])
    setRules(r || [])
    setCourts(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate(type) {
    setRuleType(type)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d],
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      label: form.label || autoLabel(),
      who: form.who,
      effect: ruleType === 'access' ? form.effect : 'allow',
      all_courts: ruleType === 'access' ? form.all_courts : true,
      court_id: (ruleType === 'access' && !form.all_courts) ? form.court_id : null,
      days_of_week: (ruleType === 'access' && form.days_of_week.length > 0) ? form.days_of_week : null,
      time_from: (ruleType === 'access' && form.time_from) ? form.time_from : null,
      time_to: (ruleType === 'access' && form.time_to) ? form.time_to : null,
      date_from: (ruleType === 'access' && form.date_from) ? form.date_from : null,
      date_to: (ruleType === 'access' && form.date_to) ? form.date_to : null,
      priority: parseInt(form.priority) || 0,
      max_concurrent_bookings: ruleType === 'quota' && form.max_concurrent_bookings !== ''
        ? parseInt(form.max_concurrent_bookings) : null,
      booking_window_days: ruleType === 'window' && form.booking_window_days !== ''
        ? parseInt(form.booking_window_days) : null,
      is_active: true,
    }
    await supabase.from('access_rules').insert(payload)
    setSaving(false)
    setShowForm(false)
    setRuleType(null)
    load()
  }

  function autoLabel() {
    const who = WHO_LABELS[form.who] || form.who
    if (ruleType === 'quota') return who + ' — max ' + form.max_concurrent_bookings + ' résa simultanée(s)'
    if (ruleType === 'window') return who + ' — ouverture ' + form.booking_window_days + 'j à l'avance'
    const effect = form.effect === 'allow' ? 'Autoriser' : 'Bloquer'
    return effect + ' — ' + who
  }

  async function toggleRule(rule) {
    await supabase.from('access_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    load()
  }

  async function deleteRule(id) {
    if (!confirm('Supprimer cette règle ?')) return
    await supabase.from('access_rules').delete().eq('id', id)
    load()
  }

  // Détermine le type d'une règle existante pour l'affichage
  function detectType(rule) {
    if (rule.max_concurrent_bookings != null) return 'quota'
    if (rule.booking_window_days != null) return 'window'
    return 'access'
  }

  const accessRules = rules.filter(r => detectType(r) === 'access')
  const quotaRules = rules.filter(r => detectType(r) === 'quota')
  const windowRules = rules.filter(r => detectType(r) === 'window')

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  function RuleCard({ rule }) {
    const type = detectType(rule)
    const typeInfo = RULE_TYPES.find(t => t.key === type)
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: rule.is_active ? 1 : 0.4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{rule.label || '—'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: rule.who === 'cotisant' ? 'var(--brand-dim)' : 'rgba(139,148,158,0.1)', color: rule.who === 'cotisant' ? 'var(--brand-light)' : 'var(--muted)' }}>
              {WHO_LABELS[rule.who] || rule.who}
            </span>
            {type === 'access' && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: rule.effect === 'allow' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: rule.effect === 'allow' ? '#4ADE80' : 'var(--red)' }}>
                {rule.effect === 'allow' ? '✓ Autorisé' : '✕ Bloqué'}
              </span>
            )}
            {type === 'access' && !rule.all_courts && rule.court && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.court.name}</span>
            )}
            {type === 'access' && rule.days_of_week && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.days_of_week.map(d => DAYS[d]).join(', ')}</span>
            )}
            {type === 'access' && rule.time_from && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.time_from.substring(0,5)} → {rule.time_to?.substring(0,5)}</span>
            )}
            {type === 'quota' && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Max {rule.max_concurrent_bookings} résa</span>
            )}
            {type === 'window' && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>{rule.booking_window_days} jours à l'avance</span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--muted)', padding: '2px 0' }}>prio {rule.priority}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => toggleRule(rule)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', cursor: 'pointer', border: '1px solid ' + (rule.is_active ? 'var(--brand)' : 'var(--border)'), background: rule.is_active ? 'var(--brand-dim)' : 'none', color: rule.is_active ? 'var(--brand-light)' : 'var(--muted)' }}>
            {rule.is_active ? 'Actif' : 'Inactif'}
          </button>
          <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
        </div>
      </div>
    )
  }

  function Section({ typeInfo, sectionRules }) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '18px' }}>{typeInfo.icon}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>{typeInfo.label}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>{sectionRules.length}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', paddingLeft: '26px' }}>{typeInfo.desc}</div>
          </div>
          <button onClick={() => openCreate(typeInfo.key)} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", flexShrink: 0, marginLeft: '12px' }}>
            + Ajouter
          </button>
        </div>
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sectionRules.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 4px' }}>Aucune règle — comportement par défaut (pas de contrainte).</p>
          ) : (
            sectionRules.map(r => <RuleCard key={r.id} rule={r} />)
          )}
        </div>
      </div>
    )
  }

  // ─── Formulaire selon le type sélectionné ───
  function FormFields() {
    if (!ruleType) return null
    return (
      <>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Label (optionnel — généré auto si vide)</label>
          <input style={fieldStyle} value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder={autoLabel()} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Qui est concerné ?</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {WHO_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setForm({...form, who: o.value})}
                style={{ background: form.who === o.value ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.who === o.value ? 'var(--brand)' : 'var(--border)'), color: form.who === o.value ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: form.who === o.value ? 600 : 400 }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {ruleType === 'access' && (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Effet</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[['allow', '✓ Autoriser'], ['deny', '✕ Bloquer']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setForm({...form, effect: val})}
                    style={{ flex: 1, background: form.effect === val ? (val === 'allow' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)') : 'var(--surface2)', border: '1px solid ' + (form.effect === val ? (val === 'allow' ? '#4ADE80' : 'var(--red)') : 'var(--border)'), color: form.effect === val ? (val === 'allow' ? '#4ADE80' : 'var(--red)') : 'var(--muted)', borderRadius: '8px', padding: '9px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Terrain (optionnel — tous par défaut)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setForm({...form, all_courts: true})} style={{ background: form.all_courts ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.all_courts ? 'var(--brand)' : 'var(--border)'), color: form.all_courts ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>Tous</button>
                {courts.map(c => (
                  <button key={c.id} onClick={() => setForm({...form, all_courts: false, court_id: c.id})}
                    style={{ background: !form.all_courts && form.court_id === c.id ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (!form.all_courts && form.court_id === c.id ? 'var(--brand)' : 'var(--border)'), color: !form.all_courts && form.court_id === c.id ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Jours (optionnel — tous par défaut)</label>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ background: form.days_of_week.includes(i) ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.days_of_week.includes(i) ? 'var(--brand)' : 'var(--border)'), color: form.days_of_week.includes(i) ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Heure de (optionnel)</label>
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
          </>
        )}

        {ruleType === 'quota' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Nombre maximum de réservations actives simultanées</label>
            <input type="number" min="0" style={fieldStyle} value={form.max_concurrent_bookings}
              onChange={e => setForm({...form, max_concurrent_bookings: e.target.value})}
              placeholder="Ex: 2" />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
              Réservations futures en cours (pending ou confirmées) où ce joueur est organisateur.
            </p>
          </div>
        )}

        {ruleType === 'window' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Peut réserver jusqu'à X jours à l'avance</label>
            <input type="number" min="1" style={fieldStyle} value={form.booking_window_days}
              onChange={e => setForm({...form, booking_window_days: e.target.value})}
              placeholder="Ex: 14" />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
              Ex: 14 = peut réserver jusqu'à 2 semaines à l'avance. Les créneaux au-delà ne sont pas encore disponibles.
            </p>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Priorité</label>
          <input type="number" style={fieldStyle} value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} />
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Plus élevé = s'applique en dernier (prioritaire en cas de conflit).</p>
        </div>
      </>
    )
  }

  const currentTypeInfo = RULE_TYPES.find(t => t.key === ruleType)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Règles d'accès</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          Trois types de règles indépendantes — chacune évaluée par priorité croissante (la plus haute l'emporte).
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : (
        <>
          <Section typeInfo={RULE_TYPES[0]} sectionRules={accessRules} />
          <Section typeInfo={RULE_TYPES[1]} sectionRules={quotaRules} />
          <Section typeInfo={RULE_TYPES[2]} sectionRules={windowRules} />
        </>
      )}

      {showForm && currentTypeInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(500px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '22px' }}>{currentTypeInfo.icon}</span>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '17px', fontWeight: 700 }}>
                  Nouvelle règle — {currentTypeInfo.label}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{currentTypeInfo.desc}</p>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', marginLeft: 'auto', flexShrink: 0 }}>✕</button>
            </div>

            <FormFields />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

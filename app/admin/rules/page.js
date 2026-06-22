'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const WHO_OPTIONS = [
  { value: 'all', label: 'Tout le monde' },
  { value: 'public', label: 'Joueurs enregistrés' },
  { value: 'cotisant', label: 'Membres du club' },
]

const WHO_LABELS = { all: 'Tout le monde', public: 'Joueurs enregistrés', cotisant: 'Membres du club', member: 'Joueurs (ancien)' }

const RULE_TYPES = [
  {
    key: 'access',
    icon: '📅',
    title: 'Accès horaire',
    description: 'Définit qui peut réserver, quels jours et à quelles heures.',
  },
  {
    key: 'quota',
    icon: '🔢',
    title: 'Quota de réservations',
    description: 'Limite le nombre de réservations actives simultanées en tant qu'organisateur.',
  },
  {
    key: 'window',
    icon: '📆',
    title: "Fenêtre d'ouverture",
    description: 'Définit combien de jours à l'avance un profil peut réserver.',
  },
]

function getRuleType(rule) {
  if (rule.max_concurrent_bookings != null) return 'quota'
  if (rule.booking_window_days != null) return 'window'
  return 'access'
}

const EMPTY_ACCESS = { label: '', who: 'public', effect: 'allow', all_courts: true, court_id: null, days_of_week: [], time_from: '', time_to: '', date_from: '', date_to: '', priority: 0 }
const EMPTY_QUOTA = { label: '', who: 'public', max_concurrent_bookings: 2, priority: 0 }
const EMPTY_WINDOW = { label: '', who: 'cotisant', booking_window_days: 14, priority: 0 }

export default function AdminRulesPage() {
  const [rules, setRules] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ruleType, setRuleType] = useState(null)
  const [form, setForm] = useState({})
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

  function openForm(type) {
    setRuleType(type)
    if (type === 'access') setForm(EMPTY_ACCESS)
    if (type === 'quota') setForm(EMPTY_QUOTA)
    if (type === 'window') setForm(EMPTY_WINDOW)
    setShowForm(true)
  }

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days_of_week: (f.days_of_week || []).includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...(f.days_of_week || []), d]
    }))
  }

  async function handleSave() {
    setSaving(true)
    const base = {
      label: form.label,
      who: form.who,
      priority: parseInt(form.priority) || 0,
      is_active: true,
      all_courts: form.all_courts !== false,
      court_id: form.all_courts !== false ? null : form.court_id,
    }

    let payload = { ...base }
    if (ruleType === 'access') {
      payload = {
        ...base,
        effect: form.effect,
        days_of_week: (form.days_of_week || []).length > 0 ? form.days_of_week : null,
        time_from: form.time_from || null,
        time_to: form.time_to || null,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
      }
    } else if (ruleType === 'quota') {
      payload = { ...base, max_concurrent_bookings: parseInt(form.max_concurrent_bookings), effect: 'allow' }
    } else if (ruleType === 'window') {
      payload = { ...base, booking_window_days: parseInt(form.booking_window_days), effect: 'allow' }
    }

    await supabase.from('access_rules').insert(payload)
    setSaving(false)
    setShowForm(false)
    setRuleType(null)
    load()
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

  const byType = {
    access: rules.filter(r => getRuleType(r) === 'access'),
    quota: rules.filter(r => getRuleType(r) === 'quota'),
    window: rules.filter(r => getRuleType(r) === 'window'),
  }

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  function RuleCard({ rule }) {
    const type = getRuleType(rule)
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', opacity: rule.is_active ? 1 : 0.45 }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{rule.label || 'Sans titre'}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>
              {WHO_LABELS[rule.who] || rule.who}
            </span>
            {type === 'access' && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: rule.effect === 'allow' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: rule.effect === 'allow' ? '#4ADE80' : 'var(--red)' }}>
                {rule.effect === 'allow' ? '✓ Autorisé' : '✕ Bloqué'}
              </span>
            )}
            {!rule.all_courts && rule.court && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.court.name}</span>
            )}
            {rule.days_of_week && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.days_of_week.map(d => DAYS[d]).join(', ')}</span>}
            {rule.time_from && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,148,158,0.1)', color: 'var(--muted)' }}>{rule.time_from.substring(0,5)} → {rule.time_to?.substring(0,5)}</span>}
            {type === 'quota' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Max {rule.max_concurrent_bookings} résa</span>}
            {type === 'window' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>{rule.booking_window_days} jours à l'avance</span>}
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Priorité {rule.priority}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => toggleRule(rule)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', cursor: 'pointer', border: '1px solid ' + (rule.is_active ? 'var(--brand)' : 'var(--border)'), background: rule.is_active ? 'var(--brand-dim)' : 'none', color: rule.is_active ? 'var(--brand-light)' : 'var(--muted)' }}>
            {rule.is_active ? 'Actif' : 'Inactif'}
          </button>
          <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--red)' }}>🗑</button>
        </div>
      </div>
    )
  }

  function Section({ typeKey }) {
    const t = RULE_TYPES.find(x => x.key === typeKey)
    const list = byType[typeKey]
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '18px' }}>{t.icon}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>{t.title}</span>
              {list.length > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>{list.length}</span>}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.description}</p>
          </div>
          <button onClick={() => openForm(typeKey)} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>
            + Ajouter
          </button>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: '13px', color: 'var(--muted)' }}>Aucune règle configurée.</div>
        ) : (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map(r => <RuleCard key={r.id} rule={r} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Règles d'accès</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', maxWidth: '520px' }}>
          Trois types de règles indépendantes. Pour chaque type, la règle de plus haute priorité qui correspond au profil du joueur s'applique.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : (
        <>
          <Section typeKey="access" />
          <Section typeKey="quota" />
          <Section typeKey="window" />
        </>
      )}

      {/* Modal formulaire — adapté au type */}
      {showForm && ruleType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(480px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header avec icône du type */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>{RULE_TYPES.find(t => t.key === ruleType).icon}</span>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '17px', fontWeight: 700 }}>
                  {RULE_TYPES.find(t => t.key === ruleType).title}
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Champs communs à tous les types */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Label (pour vous repérer)</label>
              <input style={fieldStyle} value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder={ruleType === 'access' ? 'Ex: Bloquer le soir pour les joueurs' : ruleType === 'quota' ? 'Ex: Max 2 résa pour les joueurs' : 'Ex: 14 jours pour les membres du club'} />
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Applicable à</label>
                <select style={fieldStyle} value={form.who || 'public'} onChange={e => setForm({ ...form, who: e.target.value })}>
                  {WHO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priorité</label>
                <input type="number" style={fieldStyle} value={form.priority || 0} onChange={e => setForm({ ...form, priority: e.target.value })}
                  placeholder="0" />
              </div>
            </div>

            {/* ─── Champs spécifiques ACCÈS HORAIRE ─── */}
            {ruleType === 'access' && (
              <>
                <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Effet</label>
                    <select style={fieldStyle} value={form.effect || 'allow'} onChange={e => setForm({ ...form, effect: e.target.value })}>
                      <option value="allow">✓ Autoriser</option>
                      <option value="deny">✕ Bloquer</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Terrain</label>
                    <select style={fieldStyle} value={form.all_courts !== false ? 'all' : form.court_id || ''}
                      onChange={e => setForm({ ...form, all_courts: e.target.value === 'all', court_id: e.target.value === 'all' ? null : e.target.value })}>
                      <option value="all">Tous les terrains</option>
                      {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Jours concernés (vide = tous)</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DAYS.map((d, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        style={{ background: (form.days_of_week || []).includes(i) ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + ((form.days_of_week || []).includes(i) ? 'var(--brand)' : 'var(--border)'), color: (form.days_of_week || []).includes(i) ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Heure de (vide = toute la journée)</label>
                    <input type="time" style={fieldStyle} value={form.time_from || ''} onChange={e => setForm({ ...form, time_from: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Heure à</label>
                    <input type="time" style={fieldStyle} value={form.time_to || ''} onChange={e => setForm({ ...form, time_to: e.target.value })} />
                  </div>
                </div>

                <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Date de (optionnel)</label>
                    <input type="date" style={fieldStyle} value={form.date_from || ''} onChange={e => setForm({ ...form, date_from: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date à</label>
                    <input type="date" style={fieldStyle} value={form.date_to || ''} onChange={e => setForm({ ...form, date_to: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            {/* ─── Champs spécifiques QUOTA ─── */}
            {ruleType === 'quota' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Nombre max de réservations actives simultanées</label>
                <input type="number" min="0" style={fieldStyle} value={form.max_concurrent_bookings ?? 2}
                  onChange={e => setForm({ ...form, max_concurrent_bookings: e.target.value })} />
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Réservations en cours ou à venir dont le joueur est organisateur.
                </p>
              </div>
            )}

            {/* ─── Champs spécifiques FENÊTRE ─── */}
            {ruleType === 'window' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Peut réserver jusqu'à X jours à l'avance</label>
                <input type="number" min="1" style={fieldStyle} value={form.booking_window_days ?? 14}
                  onChange={e => setForm({ ...form, booking_window_days: e.target.value })} />
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Ex: 14 → les membres du club voient les créneaux jusqu'à 14 jours à l'avance.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
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

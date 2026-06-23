'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WEEKDAYS = [0, 1, 2, 3, 4]
const WEEKEND = [5, 6]

const EMPTY_FORM = {
  label: '', time_from: '', time_to: '', price: '', days_of_week: [], sort_order: 0,
}

export default function AdminPricingPage() {
  const [slots, setSlots] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: ps }, { data: c }] = await Promise.all([
      supabase.from('price_slots').select('*').order('sort_order').order('time_from'),
      supabase.from('courts').select('id, name, price_per_slot').eq('status', 'active').order('sort_order'),
    ])
    setSlots(ps || [])
    setCourts(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d],
    }))
  }

  function setPreset(preset) {
    if (preset === 'semaine') setForm(f => ({ ...f, days_of_week: WEEKDAYS }))
    if (preset === 'weekend') setForm(f => ({ ...f, days_of_week: WEEKEND }))
    if (preset === 'all') setForm(f => ({ ...f, days_of_week: [0,1,2,3,4,5,6] }))
  }

  async function handleSave() {
    if (!form.label || !form.time_from || !form.time_to || !form.price || form.days_of_week.length === 0) return
    setSaving(true)
    await supabase.from('price_slots').insert({
      label: form.label,
      time_from: form.time_from,
      time_to: form.time_to,
      price: parseFloat(form.price),
      days_of_week: form.days_of_week,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: true,
    })
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    load()
  }

  async function toggleSlot(slot) {
    await supabase.from('price_slots').update({ is_active: !slot.is_active }).eq('id', slot.id)
    load()
  }

  async function deleteSlot(id) {
    if (!confirm('Supprimer cette tranche tarifaire ?')) return
    await supabase.from('price_slots').delete().eq('id', id)
    load()
  }

  const fieldStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Tarification</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', maxWidth: '480px' }}>
            Tranches horaires globales — s'appliquent à tous les terrains. Si aucune tranche ne couvre un créneau, le prix de base du terrain s'applique.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Ajouter une tranche
        </button>
      </div>

      {/* Prix de base des terrains */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>
          Prix de base par terrain (fallback si aucune tranche ne matche)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {courts.map(c => (
            <div key={c.id} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
              <span style={{ color: 'var(--muted)' }}>{c.name}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: 'var(--brand-light)', marginLeft: '8px' }}>{c.price_per_slot} €</span>
            </div>
          ))}
          {courts.length === 0 && <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucun terrain actif.</span>}
        </div>
      </div>

      {/* Tranches tarifaires */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
          Aucune tranche configurée — le prix de base des terrains s'applique partout.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {slots.map(slot => (
            <div key={slot.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', opacity: slot.is_active ? 1 : 0.4 }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{slot.label}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--text)', fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
                    {slot.time_from.substring(0,5)} – {slot.time_to.substring(0,5)}
                  </span>
                  <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
                    {slot.price} €
                  </span>
                  <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>
                    {slot.days_of_week.map(d => DAYS[d]).join(', ')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => toggleSlot(slot)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', cursor: 'pointer', border: '1px solid ' + (slot.is_active ? 'var(--brand)' : 'var(--border)'), background: slot.is_active ? 'var(--brand-dim)' : 'none', color: slot.is_active ? 'var(--brand-light)' : 'var(--muted)' }}>
                  {slot.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => deleteSlot(slot.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(460px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>Nouvelle tranche tarifaire</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Label</label>
              <input style={fieldStyle} value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="Ex: Heures creuses semaine" />
            </div>

            <div className="form-row-responsive" style={{ marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Heure de début</label>
                <input type="time" style={fieldStyle} value={form.time_from} onChange={e => setForm({...form, time_from: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Heure de fin</label>
                <input type="time" style={fieldStyle} value={form.time_to} onChange={e => setForm({...form, time_to: e.target.value})} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Prix (€)</label>
              <input type="number" min="0" step="0.5" style={fieldStyle} value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="Ex: 25" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Jours concernés</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {[['semaine', 'Semaine (Lun–Ven)'], ['weekend', 'Week-end (Sam–Dim)'], ['all', 'Tous les jours']].map(([k, lbl]) => (
                  <button key={k} onClick={() => setPreset(k)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ background: form.days_of_week.includes(i) ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (form.days_of_week.includes(i) ? 'var(--brand)' : 'var(--border)'), color: form.days_of_week.includes(i) ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: 'var(--amber)' }}>
              ℹ️ Si un créneau est couvert par plusieurs tranches, la plus spécifique (moins de jours) s'applique.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.label || !form.time_from || !form.time_to || !form.price || form.days_of_week.length === 0}
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

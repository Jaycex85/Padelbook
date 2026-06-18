'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const EVENT_TYPES = [
  'booking.confirmed', 'booking.cancelled', 'booking.started',
  'booking.ended', 'payment.received', 'payment.failed',
  'court.opened', 'court.closed'
]

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', endpoint_url: '', secret: '', advance_minutes: 0, event_types: [], is_active: true })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('integrations').select('*').order('created_at')
    setIntegrations(data || [])
  }

  useEffect(() => { load() }, [])

  function toggleEventType(et) {
    setForm(f => ({
      ...f,
      event_types: f.event_types.includes(et) ? f.event_types.filter(x => x !== et) : [...f.event_types, et]
    }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('integrations').insert(form)
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function toggleActive(integ) {
    await supabase.from('integrations').update({ is_active: !integ.is_active }).eq('id', integ.id)
    load()
  }

  async function deleteInteg(id) {
    await supabase.from('integrations').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Intégrations</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
            Webhooks sortants vers vos systèmes domotique (ouverture de porte, éclairage...)
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: 'var(--green)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Ajouter
        </button>
      </div>

      {/* Info stub */}
      <div style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: 'var(--amber)' }}>
        ⚠️ Les webhooks sont configurables mais non actifs en production tant que le système d'envoi n'est pas branché. Les events sont loggués dans la table <code>webhook_events</code>.
      </div>

      {integrations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
          Aucune intégration configurée.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {integrations.map(integ => (
            <div key={integ.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', opacity: integ.is_active ? 1 : 0.5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{integ.name}</div>
                {integ.description && <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>{integ.description}</div>}
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>{integ.endpoint_url}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(integ.event_types || []).map(et => (
                    <span key={et} style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', color: 'var(--green)', fontSize: '10px', padding: '2px 8px', borderRadius: '99px' }}>{et}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => toggleActive(integ)}
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', cursor: 'pointer', border: '1px solid ' + (integ.is_active ? 'var(--green)' : 'var(--border)'), background: integ.is_active ? 'rgba(74,222,128,0.08)' : 'none', color: integ.is_active ? 'var(--green)' : 'var(--muted)' }}>
                  {integ.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => deleteInteg(integ.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', fontSize: '13px' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>Nouvelle intégration</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {[
              { key: 'name', label: 'Nom', placeholder: 'Ex: Home Assistant' },
              { key: 'description', label: 'Description', placeholder: 'Optionnel' },
              { key: 'endpoint_url', label: 'URL endpoint', placeholder: 'https://homeassistant.local/webhook/...' },
              { key: 'secret', label: 'Secret (HMAC)', placeholder: 'Optionnel — pour valider la signature' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }} />
              </div>
            ))}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Avance (minutes avant le créneau)</label>
              <input type="number" min="0" value={form.advance_minutes} onChange={e => setForm({ ...form, advance_minutes: parseInt(e.target.value) })}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Events déclencheurs</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EVENT_TYPES.map(et => (
                  <button key={et} onClick={() => toggleEventType(et)}
                    style={{ background: form.event_types.includes(et) ? 'rgba(74,222,128,0.08)' : 'var(--surface2)', border: '1px solid ' + (form.event_types.includes(et) ? 'var(--green)' : 'var(--border)'), color: form.event_types.includes(et) ? 'var(--green)' : 'var(--muted)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
                    {et}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.endpoint_url}
                style={{ background: 'var(--green)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (saving || !form.name || !form.endpoint_url) ? 0.5 : 1 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

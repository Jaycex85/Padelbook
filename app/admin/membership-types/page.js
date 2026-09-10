'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { sportColor } from '../../../lib/sportColors'

export default function AdminMembershipTypesPage() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('membership_types').select('*').order('sport').order('sort_order')
    setTypes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openEdit(type) {
    setEditingId(type.id)
    setEditPrice(String(type.price))
  }

  async function savePrice(type) {
    setSaving(true)
    await supabase.from('membership_types').update({ price: parseFloat(editPrice) || 0 }).eq('id', type.id)
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function toggleActive(type) {
    await supabase.from('membership_types').update({ active: !type.active }).eq('id', type.id)
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const bySport = { padel: types.filter(t => t.sport === 'padel'), badminton: types.filter(t => t.sport === 'badminton') }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Tarifs adhésions</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
          Définis le prix de chaque licence/statut proposé aux joueurs dans "Adhésions et cotisations".
        </p>
      </div>

      {['padel', 'badminton'].map(sport => {
        if (bySport[sport].length === 0) return null
        const col = sportColor(sport)
        return (
          <div key={sport} style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '10px', color: col.text }}>
              {sport === 'padel' ? 'Padel' : 'Badminton'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bySport[sport].map(type => (
                <div key={type.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid ' + col.border, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', opacity: type.active ? 1 : 0.5 }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{type.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{type.key}{!type.active && ' · désactivé'}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingId === type.id ? (
                      <>
                        <input type="number" min="0" step="0.5" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                          style={{ width: '90px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 8px', color: 'var(--text)', fontSize: '13px' }} />
                        <button onClick={() => savePrice(type)} disabled={saving}
                          style={{ background: col.dim, border: '1px solid ' + col.border, color: col.text, borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          {saving ? '...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}>Annuler</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, color: col.text }}>{type.price.toFixed(2)} €</span>
                        <button onClick={() => openEdit(type)}
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                          Modifier
                        </button>
                        <button onClick={() => toggleActive(type)}
                          style={{ background: 'none', border: '1px solid var(--border)', color: type.active ? 'var(--red)' : 'var(--muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                          {type.active ? 'Désactiver' : 'Activer'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

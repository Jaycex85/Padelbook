'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const ROLE_LABELS = { admin: 'Admin', member: 'Membre', public: 'Public' }
const ROLE_COLORS = {
  admin: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)' },
  member: { bg: 'rgba(74,222,128,0.1)', color: 'var(--green)' },
  public: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)' },
}

export default function AdminMembersPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ role: 'public', discount_percent: 0 })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openEdit(profile) {
    setEditing(profile)
    setEditForm({ role: profile.role, discount_percent: profile.discount_percent || 0 })
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({
      role: editForm.role,
      discount_percent: parseFloat(editForm.discount_percent),
    }).eq('id', editing.id)
    setSaving(false)
    setEditing(null)
    load()
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    return !q || (p.email || '').toLowerCase().includes(q) || (p.first_name || '').toLowerCase().includes(q) || (p.last_name || '').toLowerCase().includes(q)
  })

  const displayName = p => {
    if (p.first_name || p.last_name) return (p.first_name || '') + ' ' + (p.last_name || '')
    return p.email
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Membres</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{profiles.length} utilisateur{profiles.length !== 1 ? 's' : ''}</p>
        </div>
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text)', fontSize: '14px', width: '220px', fontFamily: "'Inter',sans-serif" }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Utilisateur', 'Rôle', 'Remise', 'Wallet', 'Inscrit le', ''].map(h => (
                    <th key={h} style={{ padding: '10px 20px', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rc = ROLE_COLORS[p.role] || ROLE_COLORS.public
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(74,222,128,0.08)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--green)', flexShrink: 0 }}>
                            {(p.first_name || p.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{displayName(p)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{ background: rc.bg, color: rc.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>
                          {ROLE_LABELS[p.role]}
                        </span>
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '14px', color: p.discount_percent > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                        {p.discount_percent > 0 ? p.discount_percent + ' %' : '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '14px', color: 'var(--green)', fontFamily: "'Syne',sans-serif" }}>
                        {(p.wallet_balance || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '12px', color: 'var(--muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('fr-BE')}
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <button onClick={() => openEdit(p)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px', transition: 'all .15s' }}>
                          Modifier
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucun résultat.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>
                Modifier — {displayName(editing)}
              </h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Rôle</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }}>
                <option value="public">Public</option>
                <option value="member">Membre</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Remise personnalisée (%)
              </label>
              <input type="number" min="0" max="100" step="5"
                value={editForm.discount_percent}
                onChange={e => setEditForm({ ...editForm, discount_percent: e.target.value })}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif" }}
              />
              {editForm.discount_percent > 0 && (
                <p style={{ fontSize: '12px', color: 'var(--amber)', marginTop: '6px' }}>
                  Ce membre paiera {100 - parseFloat(editForm.discount_percent)}% du tarif standard.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} style={{ background: 'var(--green)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

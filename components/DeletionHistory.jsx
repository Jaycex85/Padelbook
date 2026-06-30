'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

export default function DeletionHistory({ entityTypes, title }) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState({})
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('deletion_log')
      .select('*')
      .in('entity_type', entityTypes)
      .order('deleted_at', { ascending: false })
      .limit(100)
    setLogs(data || [])

    const ids = [...new Set((data || []).map(l => l.deleted_by).filter(Boolean))]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', ids)
      const map = {}
      ;(profs || []).forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
    setLoading(false)
  }

  useEffect(() => { if (open) load() }, [open])

  function who(id) {
    const p = profiles[id]
    if (!p) return 'Quelqu\'un'
    return (p.first_name ? p.first_name + (p.last_name ? ' ' + p.last_name : '') : p.email) || 'Quelqu\'un'
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        🗑️ {title || 'Historique des suppressions'} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
          {loading ? (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Chargement...</div>
          ) : logs.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Aucune suppression enregistrée.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
              {logs.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '12px', padding: '8px 10px', background: 'var(--surface2)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 600 }}>{l.label}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                      Supprimé par {who(l.deleted_by)} le {new Date(l.deleted_at).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })} à {new Date(l.deleted_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'
import { sportColor } from '../../lib/sportColors'

// Filtre générique "Tout / Padel / Badminton" pour les écrans admin qui
// listent du contenu mixte. value: 'all' | 'padel' | 'badminton'.
export default function SportFilterBar({ value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', ...style }}>
      {[
        { key: 'all', label: 'Tout' },
        { key: 'padel', label: 'Padel' },
        { key: 'badminton', label: 'Badminton' },
      ].map(f => {
        const col = f.key === 'all' ? null : sportColor(f.key)
        const active = value === f.key
        return (
          <button key={f.key} onClick={() => onChange(f.key)}
            style={{
              background: active ? (col ? col.dim : 'var(--brand-dim)') : 'var(--surface)',
              border: '1px solid ' + (active ? (col ? col.border : 'var(--brand)') : 'var(--border)'),
              color: active ? (col ? col.text : 'var(--brand-light)') : 'var(--muted)',
              borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 500,
            }}>
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

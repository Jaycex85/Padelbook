'use client'
import Link from 'next/link'
import { useSport } from '../lib/sportContext'

export default function CourtsGrid({ courts }) {
  const { activeSport } = useSport()
  const filtered = activeSport ? courts.filter(c => c.sport === activeSport) : courts

  if (filtered.length === 0) return null

  return (
    <section>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>Terrains disponibles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {filtered.map(c => (
          <Link key={c.id} href={'/booking?court=' + c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{c.is_indoor ? 'Indoor' : 'Outdoor'}</span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, color: 'var(--brand-light)' }}>{c.price_per_slot} €</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
            {c.description && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{c.description}</p>}
          </Link>
        ))}
      </div>
    </section>
  )
}

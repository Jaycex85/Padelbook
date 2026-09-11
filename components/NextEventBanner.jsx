'use client'
import Link from 'next/link'
import { useSport } from '../lib/sportContext'

export default function NextEventBanner({ events }) {
  const { activeSport } = useSport()
  const nextEvent = events.find(e => !e.sport || !activeSport || e.sport === activeSport)

  if (!nextEvent) return null

  const fmtEventDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtEventTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link href="/events" style={{ display: 'block', textDecoration: 'none', marginBottom: '20px' }}>
      <div style={{ background: 'linear-gradient(135deg, var(--brand-dark), var(--surface))', border: '1px solid var(--brand)', borderRadius: '16px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--brand)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 14px', borderRadius: '0 0 0 10px', letterSpacing: '0.5px' }}>
          PROCHAIN EVENT
        </div>
        <div style={{ fontSize: '13px', color: 'var(--brand-light)', marginBottom: '4px' }}>🏆 Club Event</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '17px', fontWeight: 700, marginBottom: '6px', paddingRight: '60px' }}>
          Brussels B&P — {nextEvent.label}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {fmtEventDate(nextEvent.starts_at)} · {fmtEventTime(nextEvent.starts_at)} · {nextEvent.price_per_player} €/pers
        </div>
      </div>
    </Link>
  )
}

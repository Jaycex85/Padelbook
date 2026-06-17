import Link from 'next/link'
import { createServerSupabase } from '../lib/supabaseServer'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: courts } = await supabase
    .from('courts')
    .select('*')
    .eq('status', 'active')
    .order('sort_order')

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <h1 className="hero-title">
          Réservez votre terrain de <span className="text-green">padel</span>
        </h1>
        <p className="hero-sub">
          Créneaux disponibles en temps réel. Paiement sécurisé. Confirmation instantanée.
        </p>
        <div className="hero-actions">
          <Link href="/booking" className="btn btn-primary">📅 Réserver</Link>
          <Link href="/open-matches" className="btn btn-outline">👥 Matchs ouverts</Link>
        </div>
      </div>

      {/* Terrains */}
      {courts && courts.length > 0 && (
        <section className="section">
          <h2 className="section-title">Nos terrains</h2>
          <div className="courts-grid">
            {courts.map(court => (
              <div key={court.id} className="court-card">
                <div className="court-card-header">
                  <span className="court-type">{court.is_indoor ? 'Indoor' : 'Outdoor'}</span>
                  <span className="court-price">{court.price_per_slot} €</span>
                </div>
                <div className="court-name">{court.name}</div>
                {court.description && <p className="court-desc">{court.description}</p>}
                <Link href={'/booking?court=' + court.id} className="btn btn-primary btn-sm">
                  Réserver ce terrain
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        .hero {
          padding: 48px 0 40px;
          text-align: center;
        }
        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.5px;
          margin-bottom: 16px;
        }
        .hero-sub {
          color: var(--muted);
          font-size: 16px;
          max-width: 480px;
          margin: 0 auto 32px;
        }
        .hero-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 22px;
          border-radius: var(--radius);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          border: none;
          transition: all .15s;
        }
        .btn-primary { background: var(--green); color: #0D1117; }
        .btn-primary:hover { background: #86efac; }
        .btn-outline { background: none; color: var(--text); border: 1px solid var(--border); }
        .btn-outline:hover { border-color: var(--green); color: var(--green); }
        .btn-sm { padding: 8px 16px; font-size: 13px; }
        .section { margin-top: 32px; }
        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .courts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .court-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .court-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .court-type {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--green);
          font-weight: 500;
        }
        .court-price {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--green);
        }
        .court-name {
          font-size: 16px;
          font-weight: 500;
        }
        .court-desc {
          font-size: 13px;
          color: var(--muted);
          flex: 1;
        }
      `}</style>
    </div>
  )
}

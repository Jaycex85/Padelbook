import { createServerSupabase } from '../../lib/supabaseServer'

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabase()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [
    { count: totalBookings },
    { count: todayBookings },
    { data: recentBookings },
    { count: totalMembers },
    { count: activeCourts },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('starts_at', todayStr + 'T00:00:00').lte('starts_at', todayStr + 'T23:59:59'),
    supabase.from('bookings').select('id, starts_at, ends_at, status, total_price, court:courts(name), owner:profiles(first_name, last_name, email)').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member'),
    supabase.from('courts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const kpis = [
    { label: "Réservations aujourd'hui", value: todayBookings || 0, color: 'var(--brand)' },
    { label: 'Total confirmées', value: totalBookings || 0, color: 'var(--text)' },
    { label: 'Membres actifs', value: totalMembers || 0, color: 'var(--text)' },
    { label: 'Terrains actifs', value: activeCourts || 0, color: 'var(--text)' },
  ]

  const statusColors = {
    confirmed: { bg: 'rgba(74,222,128,0.1)', color: 'var(--brand)', label: 'Confirmé' },
    pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)', label: 'En attente' },
    cancelled: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)', label: 'Annulé' },
    completed: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Terminé' },
    expired: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Expiré' },
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
          {today.toLocaleDateString('fr-BE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Réservations récentes */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700 }}>Réservations récentes</h2>
          <a href="/admin/bookings" style={{ fontSize: '13px', color: 'var(--brand)', textDecoration: 'none' }}>Voir tout →</a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Terrain', 'Joueur', 'Créneau', 'Montant', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentBookings || []).map(b => {
                const s = statusColors[b.status] || statusColors.pending
                const owner = b.owner ? (b.owner.first_name || b.owner.email) : '—'
                const start = new Date(b.starts_at)
                const slot = start.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) + ' ' + start.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 20px', fontSize: '14px' }}>{b.court?.name || '—'}</td>
                    <td style={{ padding: '13px 20px', fontSize: '14px' }}>{owner}</td>
                    <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--muted)' }}>{slot}</td>
                    <td style={{ padding: '13px 20px', fontSize: '14px', color: 'var(--brand)', fontFamily: "'Syne',sans-serif" }}>{b.total_price} €</td>
                    <td style={{ padding: '13px 20px' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {(!recentBookings || recentBookings.length === 0) && (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucune réservation.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

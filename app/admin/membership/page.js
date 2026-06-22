'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const STATUS_LABELS = { none: 'Aucune demande', pending: 'Demande en cours', active: 'Membre du club', expired: 'Adhésion expirée' }
const STATUS_COLORS = {
  none: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)' },
  pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)' },
  active: { bg: 'rgba(74,222,128,0.1)', color: '#4ADE80' },
  expired: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)' },
}

export default function AdminMembershipPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [validating, setValidating] = useState(null)
  const [validUntil, setValidUntil] = useState('')
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('membership_status', 'none')
      .order('membership_requested_at', { ascending: false })
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Recalcule expired à la volée à l'affichage (pas de cron nécessaire)
  function effectiveStatus(p) {
    if (p.membership_status === 'active' && p.membership_valid_until) {
      const today = new Date().toISOString().split('T')[0]
      if (p.membership_valid_until < today) return 'expired'
    }
    return p.membership_status
  }

  function openValidate(profileId) {
    setValidating(profileId)
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    setValidUntil(nextYear.toISOString().split('T')[0])
  }

  async function confirmValidate() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      membership_status: 'active',
      membership_valid_until: validUntil,
      membership_validated_at: new Date().toISOString(),
      membership_validated_by: user.id,
    }).eq('id', validating)
    setValidating(null)
    load()
  }

  async function rejectRequest(profileId) {
    if (!confirm('Refuser cette demande de cotisation ?')) return
    await supabase.from('profiles').update({ membership_status: 'none', membership_valid_until: null }).eq('id', profileId)
    load()
  }

  async function revokeMembership(profileId) {
    if (!confirm('Révoquer le statut cotisant de ce membre ?')) return
    await supabase.from('profiles').update({ membership_status: 'expired' }).eq('id', profileId)
    load()
  }

  const displayName = p => (p.first_name || p.last_name) ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : p.email

  const filtered = profiles.filter(p => filter === 'all' || effectiveStatus(p) === filter)
  const pendingCount = profiles.filter(p => effectiveStatus(p) === 'pending').length

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Membres du club</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
          Valide les demandes d'adhésion annuelle (paiement géré hors application).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['pending', 'active', 'expired', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? 'var(--brand-dim)' : 'var(--surface)', border: '1px solid ' + (filter === f ? 'var(--brand)' : 'var(--border)'), color: filter === f ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
            {f === 'all' ? 'Tout' : STATUS_LABELS[f]}{f === 'pending' && pendingCount > 0 ? ' (' + pendingCount + ')' : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>Aucun résultat.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(p => {
            const status = effectiveStatus(p)
            const sc = STATUS_COLORS[status]
            return (
              <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--brand-light)', flexShrink: 0 }}>
                    {(p.first_name || p.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(p)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: sc.bg, color: sc.color, fontWeight: 500 }}>
                    {STATUS_LABELS[status]}
                  </span>
                  {p.membership_valid_until && (
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>jusqu'au {new Date(p.membership_valid_until).toLocaleDateString('fr-BE')}</span>
                  )}

                  {status === 'pending' && (
                    <>
                      <button onClick={() => openValidate(p.id)} style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        Valider
                      </button>
                      <button onClick={() => rejectRequest(p.id)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                        Refuser
                      </button>
                    </>
                  )}
                  {status === 'active' && (
                    <button onClick={() => revokeMembership(p.id)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                      Révoquer
                    </button>
                  )}
                  {status === 'expired' && (
                    <button onClick={() => openValidate(p.id)} style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      Renouveler
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {validating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setValidating(null)}>
          <div className="modal-responsive" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: 'min(380px, calc(100vw - 32px))' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Valider l'adhésion</h2>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Valide jusqu'au</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setValidating(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={confirmValidate} disabled={!validUntil} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

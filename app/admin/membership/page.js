'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { sportColor } from '../../../lib/sportColors'

const STATUS_LABELS = {
  awaiting_payment: 'En attente de paiement',
  awaiting_validation: 'À valider',
  active: 'Actif',
  rejected: 'Refusé',
  expired: 'Expiré',
}

export default function AdminMembershipPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('awaiting_validation')
  const [validating, setValidating] = useState(null)
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('membership_requests')
      .select('*, membership_type:membership_types(*), profile:profiles!membership_requests_profile_id_fkey(first_name, last_name, email)')
      .order('requested_at', { ascending: false })
    if (error) console.error('membership_requests load failed:', error)
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function effectiveStatus(r) {
    if (r.status === 'active' && r.valid_until) {
      const today = new Date().toISOString().split('T')[0]
      if (r.valid_until < today) return 'expired'
    }
    if (r.status === 'pending' && r.payment_status !== 'paid') return 'awaiting_payment'
    if (r.status === 'pending' && r.payment_status === 'paid') return 'awaiting_validation'
    return r.status
  }

  function openValidate(request) {
    setValidating(request)
    const today = new Date()
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    setValidFrom(today.toISOString().split('T')[0])
    setValidUntil(nextYear.toISOString().split('T')[0])
  }

  async function syncProfileMembershipStatus(profileId) {
    const today = new Date().toISOString().split('T')[0]
    const { data: active } = await supabase
      .from('membership_requests')
      .select('valid_until')
      .eq('profile_id', profileId)
      .eq('status', 'active')

    const stillValid = (active || []).filter(r => !r.valid_until || r.valid_until >= today)
    if (stillValid.length > 0) {
      const hasIndefinite = stillValid.some(r => !r.valid_until)
      const maxValidUntil = hasIndefinite ? null : stillValid.reduce((max, r) => (!max || r.valid_until > max) ? r.valid_until : max, null)
      await supabase.from('profiles').update({ membership_status: 'active', membership_valid_until: maxValidUntil }).eq('id', profileId)
    } else {
      await supabase.from('profiles').update({ membership_status: 'none', membership_valid_until: null }).eq('id', profileId)
    }
  }

  async function confirmValidate() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('membership_requests').update({
      status: 'active',
      valid_from: validFrom,
      valid_until: validUntil,
      validated_at: new Date().toISOString(),
      validated_by: user.id,
    }).eq('id', validating.id)
    await syncProfileMembershipStatus(validating.profile_id)
    setValidating(null)
    load()
  }

  async function rejectRequest(request) {
    if (!confirm('Refuser cette demande ?')) return
    await supabase.from('membership_requests').update({ status: 'rejected' }).eq('id', request.id)
    load()
  }

  async function revoke(request) {
    if (!confirm('Révoquer ce statut ?')) return
    await supabase.from('membership_requests').update({ status: 'expired' }).eq('id', request.id)
    await syncProfileMembershipStatus(request.profile_id)
    load()
  }

  const displayName = p => p ? ((p.first_name || p.last_name) ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : p.email) : '—'

  const filtered = requests.filter(r => filter === 'all' || effectiveStatus(r) === filter)
  const awaitingCount = requests.filter(r => effectiveStatus(r) === 'awaiting_validation').length

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Demandes d'adhésion</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
          Licences et statuts compétiteur demandés par les joueurs, par sport.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['awaiting_validation', 'active', 'awaiting_payment', 'rejected', 'expired', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? 'var(--brand-dim)' : 'var(--surface)', border: '1px solid ' + (filter === f ? 'var(--brand)' : 'var(--border)'), color: filter === f ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
            {f === 'all' ? 'Tout' : STATUS_LABELS[f]}{f === 'awaiting_validation' && awaitingCount > 0 ? ' (' + awaitingCount + ')' : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>Aucun résultat.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(r => {
            const status = effectiveStatus(r)
            const col = sportColor(r.membership_type?.sport)
            return (
              <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid ' + col.border, borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{displayName(r.profile)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.profile?.email}</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    <span style={{ color: col.text, fontWeight: 600 }}>{r.membership_type?.sport === 'badminton' ? 'Badminton' : 'Padel'}</span>
                    {' · '}{r.membership_type?.label}{' · '}{(r.price ?? 0).toFixed(2)} €
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500,
                    background: status === 'active' ? 'rgba(74,222,128,0.1)' : status === 'rejected' ? 'rgba(248,113,113,0.1)' : status === 'expired' ? 'rgba(139,148,158,0.12)' : 'rgba(252,211,77,0.1)',
                    color: status === 'active' ? '#4ADE80' : status === 'rejected' ? 'var(--red)' : status === 'expired' ? 'var(--muted)' : 'var(--amber)',
                  }}>
                    {STATUS_LABELS[status]}
                  </span>
                  {r.valid_until && status === 'active' && (
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>jusqu'au {new Date(r.valid_until).toLocaleDateString('fr-BE')}</span>
                  )}

                  {status === 'awaiting_validation' && (
                    <>
                      <button onClick={() => openValidate(r)} style={{ background: col.dim, border: '1px solid ' + col.border, color: col.text, borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        Valider
                      </button>
                      <button onClick={() => rejectRequest(r)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                        Refuser
                      </button>
                    </>
                  )}
                  {status === 'active' && (
                    <button onClick={() => revoke(r)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                      Révoquer
                    </button>
                  )}
                  {status === 'expired' && (
                    <button onClick={() => openValidate(r)} style={{ background: col.dim, border: '1px solid ' + col.border, color: col.text, borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
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
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>Valider la demande</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>{validating.membership_type?.label} — {displayName(validating.profile)}</p>

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Valide à partir du</label>
            <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', marginBottom: '14px' }} />

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Jusqu'au</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', marginBottom: '20px' }} />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setValidating(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={confirmValidate} disabled={!validFrom || !validUntil} style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

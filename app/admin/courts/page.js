'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'

const PAYMENT_MODE_LABELS = { full: 'Paiement complet', split: 'Split par joueur', wallet: 'Wallet' }
const PAYMENT_MODE_DESC = {
  full: 'Un joueur paie tout le créneau en une fois',
  split: 'Chaque joueur paie sa part individuellement',
  wallet: 'Paiement débité du solde wallet du joueur',
}
const STATUS_LABELS = { active: 'Actif', inactive: 'Inactif', maintenance: 'Maintenance' }

export default function AdminCourtsPage() {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', is_indoor: true, payment_modes: ['full'], price_per_slot: 18, status: 'active', sort_order: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('courts').select('*').order('sort_order')
    setCourts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', is_indoor: true, payment_modes: ['full'], price_per_slot: 18, status: 'active', sort_order: courts.length })
    setShowForm(true)
  }

  function openEdit(court) {
    setEditing(court)
    setForm({
      name: court.name,
      description: court.description || '',
      is_indoor: court.is_indoor,
      payment_modes: (court.payment_modes && court.payment_modes.length > 0) ? court.payment_modes : ['full'],
      price_per_slot: court.price_per_slot,
      status: court.status,
      sort_order: court.sort_order,
    })
    setShowForm(true)
  }

  function togglePaymentMode(mode) {
    setForm(f => {
      const has = f.payment_modes.includes(mode)
      let next = has ? f.payment_modes.filter(m => m !== mode) : [...f.payment_modes, mode]
      if (next.length === 0) next = [mode] // au moins un mode actif
      return { ...f, payment_modes: next }
    })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      name: form.name,
      description: form.description,
      is_indoor: form.is_indoor,
      payment_modes: form.payment_modes,
      payment_mode: form.payment_modes[0], // compat ancienne colonne
      price_per_slot: form.price_per_slot,
      status: form.status,
      sort_order: form.sort_order,
    }
    if (editing) {
      await supabase.from('courts').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('courts').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function toggleStatus(court) {
    const next = court.status === 'active' ? 'inactive' : 'active'
    await supabase.from('courts').update({ status: next }).eq('id', court.id)
    load()
  }

  async function confirmDelete(court) {
    setDeleteError(null)
    // Vérifier s'il existe des réservations liées
    const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('court_id', court.id)
    if (count && count > 0) {
      setDeleteError('Impossible de supprimer : ce terrain a ' + count + ' réservation' + (count > 1 ? 's' : '') + ' liée' + (count > 1 ? 's' : '') + '. Désactivez-le plutôt.')
      return
    }
    setDeleteTarget(court)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('weekly_schedule').delete().eq('court_id', deleteTarget.id)
    await supabase.from('blocks').delete().eq('court_id', deleteTarget.id)
    await supabase.from('access_rules').delete().eq('court_id', deleteTarget.id)
    await supabase.from('courts').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const displayModes = court => {
    const modes = (court.payment_modes && court.payment_modes.length > 0) ? court.payment_modes : [court.payment_mode || 'full']
    return modes.map(m => PAYMENT_MODE_LABELS[m]).join(' + ')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Terrains</h1>
          <p className="page-sub">{courts.length} terrain{courts.length !== 1 ? 's' : ''} configuré{courts.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Ajouter un terrain</button>
      </div>

      {deleteError && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : courts.length === 0 ? (
        <div className="empty">
          <p>Aucun terrain configuré.</p>
          <button className="btn-primary" onClick={openCreate}>Créer le premier terrain</button>
        </div>
      ) : (
        <div className="courts-list">
          {courts.map(court => (
            <div key={court.id} className="court-row">
              <div className="court-row-info">
                <div className="court-row-name">{court.name}</div>
                <div className="court-row-meta">
                  <span className={'badge ' + (court.is_indoor ? 'badge-blue' : 'badge-green')}>{court.is_indoor ? 'Indoor' : 'Outdoor'}</span>
                  <span className="meta-sep">·</span>
                  <span>{displayModes(court)}</span>
                  <span className="meta-sep">·</span>
                  <span style={{color:'var(--brand-light)'}}>{court.price_per_slot} € <span style={{color:'var(--muted)', fontWeight:400}}>({(court.price_per_slot/4).toFixed(2)} €/joueur)</span></span>
                </div>
                {court.description && <p className="court-row-desc">{court.description}</p>}
              </div>
              <div className="court-row-actions">
                <span className={'status-badge status-' + court.status}>{STATUS_LABELS[court.status]}</span>
                <button className="btn-icon" onClick={() => openEdit(court)} title="Modifier">✏️</button>
                <button className="btn-icon btn-icon-danger" onClick={() => confirmDelete(court)} title="Supprimer">🗑</button>
                <button className={'btn-toggle ' + (court.status === 'active' ? 'on' : 'off')} onClick={() => toggleStatus(court)}>
                  {court.status === 'active' ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editing ? 'Modifier ' + editing.name : 'Nouveau terrain'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nom du terrain</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Terrain A" />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optionnel" rows={2} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prix total du créneau (€)</label>
                <input className="form-input" type="number" value={form.price_per_slot} onChange={e => setForm({...form, price_per_slot: parseFloat(e.target.value)})} />
                <p style={{fontSize:'11px', color:'var(--muted)', marginTop:'4px'}}>Soit {(form.price_per_slot / 4).toFixed(2)} € par joueur (4 joueurs)</p>
              </div>
              <div className="form-group">
                <label className="form-label">Ordre d'affichage</label>
                <input className="form-input" type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: parseInt(e.target.value)})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={form.is_indoor ? 'indoor' : 'outdoor'} onChange={e => setForm({...form, is_indoor: e.target.value === 'indoor'})}>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Modes de paiement acceptés</label>
              <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'10px'}}>Le joueur choisira parmi ces options au moment de payer.</p>
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                {['full', 'split', 'wallet'].map(mode => {
                  const checked = form.payment_modes.includes(mode)
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => togglePaymentMode(mode)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                        background: checked ? 'var(--brand-dim)' : 'var(--surface2)',
                        border: '1.5px solid ' + (checked ? 'var(--brand)' : 'var(--border)'),
                        borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
                      }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                        background: checked ? 'var(--brand)' : 'transparent',
                        border: '1.5px solid ' + (checked ? 'var(--brand)' : 'var(--muted)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', color: '#fff',
                      }}>
                        {checked ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: checked ? 'var(--brand-light)' : 'var(--text)' }}>{PAYMENT_MODE_LABELS[mode]}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{PAYMENT_MODE_DESC[mode]}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Statut</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal" style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>Supprimer {deleteTarget.name} ?</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
              Cette action est irréversible. Le calendrier, les blocs et les règles d'accès liés à ce terrain seront aussi supprimés.
            </p>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
        .page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .loading, .empty { text-align:center; padding:48px; color:var(--muted); display:flex; flex-direction:column; align-items:center; gap:16px; }
        .courts-list { display:flex; flex-direction:column; gap:10px; }
        .court-row { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px 20px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .court-row-info { flex:1; min-width:0; }
        .court-row-name { font-size:16px; font-weight:500; margin-bottom:6px; }
        .court-row-meta { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); flex-wrap:wrap; }
        .meta-sep { color:var(--border); }
        .court-row-desc { font-size:13px; color:var(--muted); margin-top:6px; }
        .court-row-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .badge { font-size:11px; padding:2px 8px; border-radius:99px; font-weight:500; }
        .badge-blue { background:rgba(96,165,250,0.12); color:#93C5FD; }
        .badge-green { background:var(--brand-dim); color:var(--brand-light); }
        .status-badge { font-size:11px; padding:3px 10px; border-radius:99px; }
        .status-active { background:var(--brand-dim); color:var(--brand-light); }
        .status-inactive { background:rgba(139,148,158,0.12); color:var(--muted); }
        .status-maintenance { background:rgba(252,211,77,0.1); color:var(--amber); }
        .btn-icon { background:none; border:1px solid var(--border); border-radius:8px; padding:6px 10px; cursor:pointer; font-size:14px; transition:all .15s; }
        .btn-icon:hover { border-color:var(--muted); }
        .btn-icon-danger:hover { border-color:var(--red); }
        .btn-toggle { font-size:12px; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid var(--border); background:none; color:var(--muted); transition:all .15s; }
        .btn-toggle:hover { border-color:var(--brand); color:var(--brand-light); }
        .btn-primary { background:var(--brand); color:#fff; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; font-family:'Syne',sans-serif; }
        .btn-primary:hover { background:#6D28D9; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-outline { background:none; border:1px solid var(--border); color:var(--muted); border-radius:8px; padding:10px 20px; font-size:14px; cursor:pointer; }
        .btn-outline:hover { border-color:var(--muted); color:var(--text); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; padding:16px; }
        .modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:24px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .modal-header h2 { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; }
        .modal-close { background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer; padding:4px 8px; }
        .modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
        .form-group { margin-bottom:14px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-label { display:block; font-size:11px; font-weight:500; color:var(--muted); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.3px; }
        .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-size:14px; font-family:'Inter',sans-serif; transition:border-color .15s; }
        .form-input:focus { outline:none; border-color:var(--brand); }

        @media (max-width: 480px) {
          .modal { max-width: calc(100vw - 32px) !important; }
          .form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

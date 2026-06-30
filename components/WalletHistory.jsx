'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

function formatMoney(value) {
  const n = value || 0
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function WalletHistory({ userId }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [txs, setTxs] = useState([])
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    setTxs(data || [])
    setLoading(false)
  }

  useEffect(() => { if (open && userId) load() }, [open, userId])

  return (
    <div style={{ marginBottom: '20px' }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        🧾 Historique du wallet {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
          {loading ? (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Chargement...</div>
          ) : txs.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Aucune transaction pour l'instant.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
              {txs.map(tx => {
                const positive = (tx.amount || 0) > 0
                return (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '12px', padding: '9px 10px', background: 'var(--surface2)', borderRadius: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--text)' }}>{tx.description || (positive ? 'Recharge' : 'Débit')}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                        {new Date(tx.created_at).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })} à {new Date(tx.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '13px', color: positive ? 'var(--brand-light)' : 'var(--red)', flexShrink: 0 }}>
                      {positive ? '+' : ''}{formatMoney(tx.amount)} €
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

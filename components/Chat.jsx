'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '../lib/supabase'

const POLL_INTERVAL_MS = 7000
const CHAT_CLOSES_AFTER_DAYS = 2

/**
 * Chat réutilisable pour un booking (match) ou un club_event.
 * L'accès (lecture ET écriture) est entièrement dérivé de l'état courant :
 *  - inscrit (booking_players / event_registrations actif) => accès
 *  - sinon, accès seulement si le booking est public (is_public) ou l'event
 *    accepte le rôle de l'utilisateur (who: all/member/public)
 * Le RLS Supabase applique strictement la même règle côté serveur — ce composant
 * ne fait qu'anticiper l'UI, jamais une garantie de sécurité à lui seul.
 *
 * Props :
 *  - bookingId / eventId
 *  - endsAt : pour la fermeture auto du chat
 *  - isRegistered : l'utilisateur est-il inscrit (joueur du booking / event) ?
 *  - isPublicAccess : le booking/event est-il actuellement accessible publiquement
 *    (is_public=true pour un booking, ou who compatible avec le rôle pour un event) ?
 *  - isAdmin
 */
export default function Chat({ bookingId, eventId, endsAt, isRegistered, isPublicAccess, isAdmin }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const scrollRef = useRef(null)
  const supabase = createClient()

  const hasAccess = isAdmin || isRegistered || isPublicAccess
  const canWrite = hasAccess && !!userId

  const isClosed = endsAt
    ? (new Date() > new Date(new Date(endsAt).getTime() + CHAT_CLOSES_AFTER_DAYS * 24 * 3600 * 1000))
    : false

  const load = useCallback(async () => {
    if (!hasAccess) { setLoading(false); return }

    const filterCol = bookingId ? 'booking_id' : 'event_id'
    const filterVal = bookingId || eventId
    const { data: msgs, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq(filterCol, filterVal)
      .order('created_at', { ascending: true })

    if (error) { setAccessDenied(true); setLoading(false); return }

    setMessages(msgs || [])

    const senderIds = [...new Set((msgs || []).map(m => m.sender_id))]
    const unknown = senderIds.filter(id => !profiles[id])
    if (unknown.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', unknown)
      if (profs) {
        setProfiles(prev => {
          const next = { ...prev }
          profs.forEach(p => { next[p.id] = p })
          return next
        })
      }
    }
    setLoading(false)
  }, [bookingId, eventId, hasAccess])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  useEffect(() => {
    load()
    if (isClosed || !hasAccess) return
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load, isClosed, hasAccess])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  async function handleSend() {
    if (!text.trim() || sending || !canWrite) return
    setSending(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text.trim(),
        ...(bookingId ? { booking_id: bookingId } : { event_id: eventId }),
      }),
    })
    if (res.ok) {
      setText('')
      load()
    }
    setSending(false)
  }

  const displayName = p => {
    if (!p) return 'Joueur'
    return p.first_name ? (p.first_name + (p.last_name ? ' ' + p.last_name[0] + '.' : '')) : p.email?.split('@')[0]
  }

  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  // Pas d'accès du tout (ni inscrit, ni public) => le composant ne s'affiche pas
  if (!hasAccess) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
        🔒 Ce chat est réservé aux joueurs inscrits.
      </div>
    )
  }

  if (isClosed) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
        💬 Ce chat est archivé (clôturé 48h après l'événement).
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
        <span>💬 Discussion</span>
        {!isRegistered && isPublicAccess && (
          <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--brand-light)', background: 'var(--brand-dim)', padding: '2px 8px', borderRadius: '99px' }}>
            Vous n'êtes pas inscrit
          </span>
        )}
      </div>

      <div ref={scrollRef} style={{ maxHeight: '280px', minHeight: '120px', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '12px' }}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '12px' }}>
            {isRegistered ? 'Aucun message. Lancez la discussion !' : 'Aucun message. Posez votre question !'}
          </div>
        ) : (
          messages.map(m => {
            const isMe = m.sender_id === userId
            const p = profiles[m.sender_id]
            const isAdminMsg = p?.role === 'admin'
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: '11px', color: isAdminMsg ? 'var(--brand-light)' : 'var(--muted)', marginBottom: '2px', fontWeight: isAdminMsg ? 600 : 400 }}>
                  {isMe ? 'Vous' : displayName(p)}{isAdminMsg ? ' · Admin' : ''}
                </div>
                <div style={{
                  background: isMe ? 'var(--brand)' : 'var(--surface2)',
                  color: isMe ? '#fff' : 'var(--text)',
                  borderRadius: '12px',
                  borderBottomRightRadius: isMe ? '2px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '2px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  maxWidth: '85%',
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{fmtTime(m.created_at)}</div>
              </div>
            )
          })
        )}
      </div>

      {canWrite ? (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isRegistered ? 'Votre message...' : 'Poser une question avant de rejoindre...'}
            style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '9px 14px', color: 'var(--text)', fontSize: '13px', fontFamily: "'Inter',sans-serif" }}
          />
          <button onClick={handleSend} disabled={sending || !text.trim()}
            style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, cursor: 'pointer', fontSize: '15px', opacity: (sending || !text.trim()) ? 0.5 : 1 }}>
            ➤
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          Connectez-vous pour écrire.
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

export default function ClubFeed({ isAdmin, userId }) {
  const [posts, setPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [newPostText, setNewPostText] = useState('')
  const [posting, setPosting] = useState(false)
  const [isPollMode, setIsPollMode] = useState(false)
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [votes, setVotes] = useState({}) // option_id -> [voter_id, ...]
  const [voting, setVoting] = useState(null)
  const [expandedComments, setExpandedComments] = useState(null)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [sendingComment, setSendingComment] = useState(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data: postsData } = await supabase
      .from('club_posts')
      .select('*, club_post_comments(id, author_id, content, created_at), club_poll_options(id, label, sort_order, club_poll_votes(id, voter_id))')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)

    setPosts(postsData || [])

    const voteMap = {}
    ;(postsData || []).forEach(p => {
      ;(p.club_poll_options || []).forEach(o => {
        voteMap[o.id] = (o.club_poll_votes || []).map(v => v.voter_id)
      })
    })
    setVotes(voteMap)

    const authorIds = new Set()
    ;(postsData || []).forEach(p => {
      authorIds.add(p.author_id)
      ;(p.club_post_comments || []).forEach(c => authorIds.add(c.author_id))
      ;(p.club_poll_options || []).forEach(o => (o.club_poll_votes || []).forEach(v => authorIds.add(v.voter_id)))
    })
    const ids = [...authorIds]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', ids)
      const map = {}
      ;(profs || []).forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handlePublish() {
    if (!newPostText.trim() || posting) return
    if (isPollMode && pollOptions.filter(o => o.trim()).length < 2) return
    setPosting(true)
    await fetch('/api/club-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: newPostText.trim(),
        pinned: false,
        post_type: isPollMode ? 'poll' : 'text',
        options: isPollMode ? pollOptions.filter(o => o.trim()) : undefined,
      }),
    })
    setNewPostText('')
    setIsPollMode(false)
    setPollOptions(['', ''])
    setPosting(false)
    load()
  }

  function updatePollOption(i, value) {
    setPollOptions(opts => opts.map((o, idx) => idx === i ? value : o))
  }
  function addPollOption() {
    setPollOptions(opts => [...opts, ''])
  }
  function removePollOption(i) {
    setPollOptions(opts => opts.filter((_, idx) => idx !== i))
  }

  async function toggleVote(optionId, alreadyVoted) {
    if (!userId || voting) return
    setVoting(optionId)
    if (alreadyVoted) {
      await supabase.from('club_poll_votes').delete().eq('option_id', optionId).eq('voter_id', userId)
    } else {
      await supabase.from('club_poll_votes').insert({ option_id: optionId, voter_id: userId })
    }
    await load()
    setVoting(null)
  }

  async function handleDeletePost(postId) {
    if (!confirm('Supprimer ce poste et ses commentaires ?')) return
    await supabase.from('club_posts').delete().eq('id', postId)
    load()
  }

  async function togglePin(post) {
    await supabase.from('club_posts').update({ pinned: !post.pinned }).eq('id', post.id)
    load()
  }

  async function handleComment(postId) {
    const text = (commentDrafts[postId] || '').trim()
    if (!text) return
    setSendingComment(postId)
    await supabase.from('club_post_comments').insert({ post_id: postId, author_id: userId, content: text })
    setCommentDrafts(d => ({ ...d, [postId]: '' }))
    setSendingComment(null)
    load()
  }

  async function handleDeleteComment(commentId) {
    await supabase.from('club_post_comments').delete().eq('id', commentId)
    load()
  }

  const displayName = id => {
    const p = profiles[id]
    if (!p) return 'Membre'
    return p.first_name ? (p.first_name + (p.last_name ? ' ' + p.last_name[0] + '.' : '')) : p.email?.split('@')[0]
  }
  const isAuthorAdmin = id => profiles[id]?.role === 'admin'
  const fmtDate = d => {
    const date = new Date(d)
    const now = new Date()
    const diffH = (now - date) / 3600000
    if (diffH < 1) return 'à l\'instant'
    if (diffH < 24) return Math.floor(diffH) + 'h'
    return date.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
  }

  if (loading) return null
  if (posts.length === 0 && !isAdmin) return null

  return (
    <section style={{ marginBottom: '28px' }}>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>📣 Annonces du club</h2>

      {isAdmin && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
          <textarea
            value={newPostText}
            onChange={e => setNewPostText(e.target.value)}
            placeholder={isPollMode ? "Question du sondage..." : "Publier une annonce pour les membres..."}
            rows={2}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: "'Inter',sans-serif", resize: 'vertical', marginBottom: '8px' }}
          />

          {isPollMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    value={opt}
                    onChange={e => updatePollOption(i, e.target.value)}
                    placeholder={'Option ' + (i + 1)}
                    style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '13px', fontFamily: "'Inter',sans-serif" }}
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => removePollOption(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', padding: '4px' }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={addPollOption} style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}>
                + Ajouter une option
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isPollMode} onChange={e => setIsPollMode(e.target.checked)} />
              📊 Sondage (choix multiple)
            </label>
            <button onClick={handlePublish} disabled={posting || !newPostText.trim() || (isPollMode && pollOptions.filter(o => o.trim()).length < 2)}
              style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (posting || !newPostText.trim() || (isPollMode && pollOptions.filter(o => o.trim()).length < 2)) ? 0.5 : 1 }}>
              {posting ? 'Publication...' : 'Publier'}
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        isAdmin && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucune annonce pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {posts.map(post => {
            const comments = post.club_post_comments || []
            const showComments = expandedComments === post.id
            return (
              <div key={post.id} style={{ background: 'var(--surface)', border: '1px solid ' + (post.pinned ? 'var(--brand)' : 'var(--border)'), borderRadius: '14px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--brand-light)', flexShrink: 0 }}>
                      🎾
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Mayfair Padel Club</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{fmtDate(post.created_at)}{post.pinned ? ' · 📌 Épinglé' : ''}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => togglePin(post)} title="Épingler" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer', fontSize: '11px' }}>📌</button>
                      <button onClick={() => handleDeletePost(post.id)} title="Supprimer" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer', fontSize: '11px', color: 'var(--red)' }}>🗑</button>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5, marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{post.content}</p>

                {post.post_type === 'poll' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {(() => {
                      const opts = [...(post.club_poll_options || [])].sort((a, b) => a.sort_order - b.sort_order)
                      const totalVoters = new Set(opts.flatMap(o => votes[o.id] || [])).size
                      const maxVotes = Math.max(1, ...opts.map(o => (votes[o.id] || []).length))
                      return opts.map(opt => {
                        const optVoters = votes[opt.id] || []
                        const count = optVoters.length
                        const pct = maxVotes > 0 ? Math.round((count / maxVotes) * 100) : 0
                        const userVoted = userId && optVoters.includes(userId)
                        return (
                          <div key={opt.id}>
                            <button onClick={() => toggleVote(opt.id, userVoted)} disabled={voting === opt.id || !userId}
                              style={{ width: '100%', position: 'relative', textAlign: 'left', background: 'var(--surface2)', border: '1px solid ' + (userVoted ? 'var(--brand)' : 'var(--border)'), borderRadius: '10px', padding: '9px 12px', cursor: userId ? 'pointer' : 'default', overflow: 'hidden', fontFamily: "'Inter',sans-serif" }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: pct + '%', background: 'var(--brand-dim)', transition: 'width 0.3s', zIndex: 0 }} />
                              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text)' }}>{userVoted ? '✓ ' : ''}{opt.label}</span>
                                <span style={{ color: 'var(--muted)', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>{count}</span>
                              </div>
                            </button>
                            {optVoters.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '4px 12px 0' }}>
                                {optVoters.map(vid => displayName(vid)).join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {new Set((post.club_poll_options || []).flatMap(o => votes[o.id] || [])).size} participant{new Set((post.club_poll_options || []).flatMap(o => votes[o.id] || [])).size !== 1 ? 's' : ''} · choix multiple possible
                    </div>
                  </div>
                )}

                <button onClick={() => setExpandedComments(showComments ? null : post.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                  💬 {comments.length} commentaire{comments.length !== 1 ? 's' : ''} {showComments ? '▲' : '▼'}
                </button>

                {showComments && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    {comments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        {comments.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '7px 11px', fontSize: '13px', flex: 1 }}>
                              <span style={{ fontWeight: 600, color: isAuthorAdmin(c.author_id) ? 'var(--brand-light)' : 'var(--text)', marginRight: '6px' }}>
                                {displayName(c.author_id)}{isAuthorAdmin(c.author_id) ? ' · Admin' : ''}
                              </span>
                              {c.content}
                            </div>
                            {(c.author_id === userId || isAdmin) && (
                              <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {userId && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          value={commentDrafts[post.id] || ''}
                          onChange={e => setCommentDrafts(d => ({ ...d, [post.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                          placeholder="Votre commentaire..."
                          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '7px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: "'Inter',sans-serif" }}
                        />
                        <button onClick={() => handleComment(post.id)} disabled={sendingComment === post.id || !(commentDrafts[post.id] || '').trim()}
                          style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '20px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                          Envoyer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

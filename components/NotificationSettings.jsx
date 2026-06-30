'use client'
import { useState, useEffect } from 'react'
import { registerPushSubscription, savePushSubscription, unregisterPushSubscription, isPushSubscribed } from '../lib/pushUtils'

const PREF_LABELS = {
  booking_confirmed: { label: 'Confirmation de réservation', desc: 'Quand une réservation est confirmée' },
  booking_reminder:  { label: 'Rappel J-1', desc: "La veille de chaque réservation" },
  chat_message:      { label: 'Nouveau message', desc: "Quand quelqu'un écrit dans le chat d'un match/event" },
  club_announcement: { label: 'Annonces du club', desc: "Quand l'admin publie une annonce" },
  spot_available:    { label: 'Terrain disponible', desc: "Quand un créneau réservé se libère (annulation, événement ou bloc supprimé) et que vous pouvez le réserver" },
}

export default function NotificationSettings() {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [iosNotInstalled, setIosNotInstalled] = useState(false)

  useEffect(() => {
    // Détection iOS Safari hors PWA installée : Apple n'autorise le Web Push
    // que pour les PWA ajoutées à l'écran d'accueil (mode standalone).
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (isIOS && !isStandalone) {
      setIosNotInstalled(true)
      setLoading(false)
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false); setLoading(false); return
    }
    async function init() {
      const sub = await isPushSubscribed()
      setSubscribed(sub)
      if (sub) {
        const res = await fetch('/api/push/preferences')
        setPrefs(await res.json())
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleToggleSubscription() {
    setToggling(true)
    if (subscribed) {
      await unregisterPushSubscription()
      setSubscribed(false)
      setPrefs(null)
    } else {
      const sub = await registerPushSubscription()
      if (sub) {
        await savePushSubscription(sub)
        setSubscribed(true)
        const res = await fetch('/api/push/preferences')
        setPrefs(await res.json())
      }
    }
    setToggling(false)
  }

  async function handlePrefChange(key, value) {
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)
    await fetch('/api/push/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
  }

  if (iosNotInstalled) {
    return (
      <div style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: 'var(--amber)', lineHeight: 1.5 }}>
        📱 Sur iPhone/iPad, les notifications ne fonctionnent que si l'appli est installée sur l'écran d'accueil.
        <br /><br />
        Pour l'installer : appuie sur l'icône <strong>Partager</strong> ⬆️ dans Safari, puis <strong>"Sur l'écran d'accueil"</strong>. Ouvre ensuite l'appli depuis cette icône pour activer les notifications.
      </div>
    )
  }

  if (!supported) {
    return (
      <div style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: 'var(--amber)' }}>
        ⚠️ Votre navigateur ne supporte pas les notifications push.
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: subscribed ? '16px' : 0, gap: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>🔔 Notifications push</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {subscribed ? 'Activées sur cet appareil' : 'Désactivées sur cet appareil'}
          </div>
        </div>
        <button onClick={handleToggleSubscription} disabled={toggling || loading}
          style={{ background: subscribed ? 'rgba(248,113,113,0.1)' : 'var(--brand-dim)', border: '1px solid ' + (subscribed ? 'var(--red)' : 'var(--brand)'), color: subscribed ? 'var(--red)' : 'var(--brand-light)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: (toggling || loading) ? 0.6 : 1 }}>
          {toggling ? '...' : subscribed ? 'Désactiver' : 'Activer'}
        </button>
      </div>

      {subscribed && prefs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(PREF_LABELS).map(([key, info]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{info.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{info.desc}</div>
              </div>
              <button onClick={() => handlePrefChange(key, !prefs[key])}
                style={{ width: '44px', height: '24px', borderRadius: '99px', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, background: prefs[key] ? 'var(--brand)' : 'var(--border)', transition: 'background .2s' }}>
                <div style={{ position: 'absolute', top: '3px', left: prefs[key] ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '50%', transition: 'left .2s' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


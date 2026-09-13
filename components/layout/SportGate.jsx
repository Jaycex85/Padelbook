'use client'
import { useSport, SPORTS } from '../../lib/sportContext'
import { useLocale } from '../../lib/i18n/LocaleContext'

// À utiliser dans une page qui a besoin d'un sport actif :
//   const { activeSport } = useSport()
//   if (!activeSport) return <SportGate />
// N'affecte pas les pages communes (accueil, fil du club) qui n'ont pas
// besoin de connaître le sport pour s'afficher.
export default function SportGate() {
  const { setActiveSport } = useSport()
  const { t } = useLocale()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '24px', padding: '24px',
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: 800, textAlign: 'center' }}>
        {t('sportGate.question')}
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveSport(SPORTS.PADEL)}
          style={{
            width: '160px', padding: '28px 16px', borderRadius: '16px',
            background: 'rgba(124,58,237,0.10)', border: '1px solid #7C3AED',
            color: '#C084FC', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          {t('common.padel')}
        </button>
        <button
          onClick={() => setActiveSport(SPORTS.BADMINTON)}
          style={{
            width: '160px', padding: '28px 16px', borderRadius: '16px',
            background: 'rgba(163,230,53,0.10)', border: '1px solid #A3E635',
            color: '#D9F99D', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          {t('common.badminton')}
        </button>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
        {t('sportGate.canChangeLater')}
      </div>
    </div>
  )
}

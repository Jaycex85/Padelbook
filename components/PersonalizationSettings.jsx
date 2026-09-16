'use client'
import { useLocale } from '../lib/i18n/LocaleContext'
import { usePreferences } from '../lib/preferencesContext'

const TILE_NAV_KEYS = {
  booking: 'nav.booking',
  events: 'nav.clubEvents',
  openMatches: 'nav.openMatches',
  myBookings: 'nav.myBookings',
}

export default function PersonalizationSettings() {
  const { t } = useLocale()
  const { highContrast, setHighContrast, homeTiles, toggleTile, moveTile } = usePreferences()

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>{t('personalization.title')}</div>

      {/* Contraste élevé */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{t('personalization.highContrastLabel')}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{t('personalization.highContrastDesc')}</div>
        </div>
        <button
          onClick={() => setHighContrast(!highContrast)}
          role="switch"
          aria-checked={highContrast}
          style={{
            width: '44px', height: '26px', borderRadius: '99px', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: highContrast ? 'var(--brand)' : 'var(--surface2)', position: 'relative', transition: 'background .15s',
          }}
        >
          <span style={{
            position: 'absolute', top: '3px', left: highContrast ? '21px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left .15s',
          }} />
        </button>
      </div>

      {/* Raccourcis accueil */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{t('personalization.homeTilesLabel')}</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', marginBottom: '10px' }}>{t('personalization.homeTilesDesc')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {homeTiles.map((tile, i) => (
            <div key={tile.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer', fontSize: '13px', color: tile.visible ? 'var(--text)' : 'var(--muted)' }}>
                <input type="checkbox" checked={tile.visible} onChange={() => toggleTile(tile.key)} />
                {t(TILE_NAV_KEYS[tile.key])}
              </label>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={() => moveTile(tile.key, -1)} disabled={i === 0}
                  style={{ background: 'none', border: 'none', color: i === 0 ? 'var(--border)' : 'var(--muted)', cursor: i === 0 ? 'default' : 'pointer', fontSize: '13px', padding: '4px 6px' }}>▲</button>
                <button onClick={() => moveTile(tile.key, 1)} disabled={i === homeTiles.length - 1}
                  style={{ background: 'none', border: 'none', color: i === homeTiles.length - 1 ? 'var(--border)' : 'var(--muted)', cursor: i === homeTiles.length - 1 ? 'default' : 'pointer', fontSize: '13px', padding: '4px 6px' }}>▼</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

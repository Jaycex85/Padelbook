'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'ui_preferences'

export const DEFAULT_HOME_TILES = [
  { key: 'booking', visible: true },
  { key: 'events', visible: true },
  { key: 'openMatches', visible: true },
  { key: 'myBookings', visible: true },
]

const DEFAULTS = {
  homeTiles: DEFAULT_HOME_TILES,
  highContrast: false,
}

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge défensif : si de nouvelles tuiles sont ajoutées plus tard côté code,
        // elles apparaissent quand même pour les gens qui ont déjà une préférence sauvegardée.
        const mergedTiles = DEFAULT_HOME_TILES.map(def => {
          const existing = (parsed.homeTiles || []).find(t => t.key === def.key)
          return existing || def
        })
        setPrefs({ ...DEFAULTS, ...parsed, homeTiles: mergedTiles })
      }
    } catch (e) { /* localStorage indisponible ou JSON invalide : on garde les défauts */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    document.documentElement.dataset.contrast = prefs.highContrast ? 'high' : 'normal'
  }, [loaded, prefs.highContrast])

  const save = useCallback((next) => {
    setPrefs(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
  }, [])

  const setHighContrast = useCallback((value) => {
    save({ ...prefs, highContrast: value })
  }, [prefs, save])

  const setHomeTiles = useCallback((tiles) => {
    save({ ...prefs, homeTiles: tiles })
  }, [prefs, save])

  const toggleTile = useCallback((key) => {
    const tiles = prefs.homeTiles.map(t => t.key === key ? { ...t, visible: !t.visible } : t)
    setHomeTiles(tiles)
  }, [prefs.homeTiles, setHomeTiles])

  const moveTile = useCallback((key, direction) => {
    const tiles = [...prefs.homeTiles]
    const idx = tiles.findIndex(t => t.key === key)
    const swapWith = idx + direction
    if (idx < 0 || swapWith < 0 || swapWith >= tiles.length) return
    ;[tiles[idx], tiles[swapWith]] = [tiles[swapWith], tiles[idx]]
    setHomeTiles(tiles)
  }, [prefs.homeTiles, setHomeTiles])

  return (
    <PreferencesContext.Provider value={{ ...prefs, setHighContrast, setHomeTiles, toggleTile, moveTile }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}

'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const SportContext = createContext(null)
export const SPORTS = { PADEL: 'padel', BADMINTON: 'badminton' }

// Choix éphémère : demandé à chaque rechargement/lancement de l'app, jamais
// persisté (ni en base, ni en sessionStorage/localStorage) — un joueur peut
// faire du padel un jour et du badminton le lendemain. L'état vit uniquement
// en mémoire le temps de la session React ; un refresh repart à zéro.
export function SportProvider({ children }) {
  const [activeSport, setActiveSportState] = useState(null)

  useEffect(() => {
    if (activeSport) {
      document.documentElement.dataset.sport = activeSport
    } else {
      delete document.documentElement.dataset.sport
    }
  }, [activeSport])

  const setActiveSport = useCallback((sport) => {
    setActiveSportState(sport)
  }, [])

  return (
    <SportContext.Provider value={{ activeSport, setActiveSport }}>
      {children}
    </SportContext.Provider>
  )
}

export function useSport() {
  const ctx = useContext(SportContext)
  if (!ctx) throw new Error('useSport must be used within a SportProvider')
  return ctx
}


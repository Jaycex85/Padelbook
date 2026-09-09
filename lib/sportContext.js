'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const SportContext = createContext(null)
const STORAGE_KEY = 'activeSport'
export const SPORTS = { PADEL: 'padel', BADMINTON: 'badminton' }

// Choix éphémère, volontairement NON persisté en base ni en localStorage :
// un joueur peut faire du padel un jour et du badminton le lendemain.
// sessionStorage = tient le temps de l'onglet/session, repart à zéro ensuite.
export function SportProvider({ children }) {
  const [activeSport, setActiveSportState] = useState(null) // null = pas encore choisi cette session

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === SPORTS.PADEL || stored === SPORTS.BADMINTON) {
      setActiveSportState(stored)
    }
  }, [])

  useEffect(() => {
    if (activeSport) {
      document.documentElement.dataset.sport = activeSport
    } else {
      delete document.documentElement.dataset.sport
    }
  }, [activeSport])

  const setActiveSport = useCallback((sport) => {
    sessionStorage.setItem(STORAGE_KEY, sport)
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

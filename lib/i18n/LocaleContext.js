'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import fr from './fr'
import en from './en'
import nl from './nl'

const DICTS = { fr, en, nl }
export const LOCALES = [
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
]
const STORAGE_KEY = 'locale'
const DEFAULT_LOCALE = 'fr'

const LocaleContext = createContext(null)

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

// Contrairement au sport (choisi à chaque session), la langue est une
// préférence durable de l'utilisateur : persistée en localStorage.
export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && DICTS[stored]) setLocaleState(stored)
  }, [])

  const setLocale = useCallback((code) => {
    if (!DICTS[code]) return
    localStorage.setItem(STORAGE_KEY, code)
    setLocaleState(code)
  }, [])

  const t = useCallback((key, vars) => {
    let str = getNested(DICTS[locale], key) ?? getNested(DICTS[DEFAULT_LOCALE], key) ?? key
    if (vars && typeof str === 'string') {
      Object.entries(vars).forEach(([k, v]) => { str = str.replace('{' + k + '}', v) })
    }
    return str
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}

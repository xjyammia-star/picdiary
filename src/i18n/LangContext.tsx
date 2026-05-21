import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { translations } from './translations'
import type { Language } from '../types'

interface LangContextType {
  lang: Language
  setLang: (l: Language) => void
  t: (key: string, ...args: any[]) => string
}

const LangContext = createContext<LangContextType>({
  lang: 'zh',
  setLang: () => {},
  t: (k) => k,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('picdiary_lang') as Language) || 'zh'
  })

  const setLang = useCallback((l: Language) => {
    setLangState(l)
    localStorage.setItem('picdiary_lang', l)
  }, [])

  const t = useCallback((key: string, ...args: any[]): string => {
    const dict = translations[lang] as any
    const val = dict[key]
    if (typeof val === 'function') return val(...args)
    return val ?? key
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)

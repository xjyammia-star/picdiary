import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { User, AuthState } from '../types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('picdiary_token')
    const userStr = localStorage.getItem('picdiary_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        setState({ user, token, isLoading: false })
      } catch {
        setState({ user: null, token: null, isLoading: false })
      }
    } else {
      setState(s => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('picdiary_token', data.token)
    localStorage.setItem('picdiary_user', JSON.stringify(data.user))
    setState({ user: data.user, token: data.token, isLoading: false })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Register failed')
    localStorage.setItem('picdiary_token', data.token)
    localStorage.setItem('picdiary_user', JSON.stringify(data.user))
    setState({ user: data.user, token: data.token, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('picdiary_token')
    localStorage.removeItem('picdiary_user')
    setState({ user: null, token: null, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

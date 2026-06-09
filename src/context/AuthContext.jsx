import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'mqc_auth_token'
const USER_KEY  = 'mqc_auth_user'

// In Electron we use localStorage as a fallback (safeStorage would be in main process).
// Token is stored in localStorage — adequate for a local desktop app.
export const tokenStorage = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (token) => {
    try { localStorage.setItem(TOKEN_KEY, token) } catch {}
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {}
  },
}

const LOCK_KEY = 'mqc_login_lock'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

export const lockState = {
  get: (username) => {
    try {
      const raw = localStorage.getItem(`${LOCK_KEY}_${username}`)
      return raw ? JSON.parse(raw) : { attempts: 0, locked_until: null }
    } catch { return { attempts: 0, locked_until: null } }
  },
  increment: (username) => {
    const s = lockState.get(username)
    s.attempts = (s.attempts || 0) + 1
    if (s.attempts >= MAX_ATTEMPTS) {
      s.locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString()
    }
    try { localStorage.setItem(`${LOCK_KEY}_${username}`, JSON.stringify(s)) } catch {}
    return MAX_ATTEMPTS - s.attempts
  },
  clear: (username) => {
    try { localStorage.removeItem(`${LOCK_KEY}_${username}`) } catch {}
  },
  isLocked: (username) => {
    const s = lockState.get(username)
    if (!s.locked_until) return { locked: false }
    if (new Date() < new Date(s.locked_until)) {
      const remaining = Math.ceil((new Date(s.locked_until) - new Date()) / 60000)
      return { locked: true, remaining }
    }
    lockState.clear(username)
    return { locked: false }
  },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)

  const logout = useCallback(async (silent = false) => {
    const token = tokenStorage.get()
    if (token && !silent) {
      try {
        await fetch('http://127.0.0.1:8000/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {}
    }
    tokenStorage.clear()
    setUser(null)
  }, [])

  // Validate token on app start
  useEffect(() => {
    const init = async () => {
      const token = tokenStorage.get()
      if (!token) {
        setAuthLoading(false)
        return
      }
      try {
        const res = await fetch('http://127.0.0.1:8000/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const userData = await res.json()
          setUser(userData)
        } else {
          tokenStorage.clear()
        }
      } catch (err) {
        // Backend not reachable — don't clear token, show error
        if (err.message?.includes('fetch')) {
          setBackendError(true)
        } else {
          tokenStorage.clear()
        }
      } finally {
        setAuthLoading(false)
      }
    }
    init()
  }, [])

  const login = useCallback(async (username, password) => {
    const lockCheck = lockState.isLocked(username)
    if (lockCheck.locked) {
      throw new Error(`Account locked. Try again in ${lockCheck.remaining} minute${lockCheck.remaining !== 1 ? 's' : ''}.`)
    }

    const res = await fetch('http://127.0.0.1:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      const data = await res.json()
      lockState.clear(username)
      tokenStorage.set(data.access_token)
      setUser(data.user)
      return data.user
    } else {
      const remaining = lockState.increment(username)
      const data = await res.json().catch(() => ({}))
      if (remaining <= 0) {
        throw new Error(`Too many attempts. Account locked for 15 minutes.`)
      }
      throw new Error(
        data.detail || `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      )
    }
  }, [])

  const hasPermission = useCallback((permission) => {
    if (!user) return false
    const PERMISSIONS = {
      admin:    ['live_inspection','roll_history','analytics','settings_read','settings_write','user_management','delete_rolls','audit_log'],
      operator: ['live_inspection','roll_history','analytics','settings_read'],
      viewer:   ['roll_history','analytics'],
    }
    return (PERMISSIONS[user.role] || []).includes(permission)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, authLoading, backendError, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

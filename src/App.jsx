import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import TitleBar from './components/layout/TitleBar'
import LiveInspection from './pages/LiveInspection'
import RollHistory from './pages/RollHistory'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Help from './pages/Help'
import Login from './pages/Login'
import Landing from './pages/Landing'
import AuditLog from './pages/AuditLog'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { InspectionProvider } from './context/InspectionContext'
import { NavigationProvider } from './context/NavigationContext'
import { AuthProvider, useAuth, tokenStorage } from './context/AuthContext'

const TITLE_H = 36   // must match TitleBar height

function AuthGate() {
  const { user, authLoading, backendError } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  // After logout, always return to landing
  const prevUser = React.useRef(user)
  useEffect(() => {
    if (prevUser.current && !user) setShowLogin(false)
    prevUser.current = user
  }, [user])

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'fixed', inset: 0, top: TITLE_H,
        background: '#0F1A1F',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#F7A536',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (backendError && !user) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'fixed', inset: 0, top: TITLE_H,
        background: '#0F1A1F', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚡</div>
        <h2 style={{ color: '#F1F5F9', margin: 0 }}>Backend Not Running</h2>
        <p style={{ color: '#64748B', margin: 0, textAlign: 'center', maxWidth: 360 }}>
          The Magic QC backend server is not reachable at localhost:8000.<br />
          Start the Python backend and refresh.
        </p>
        <button onClick={() => window.location.reload()} style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 8,
          background: '#264C59', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>
          Retry
        </button>
      </div>
    )
  }

  if (!user) {
    if (showLogin) {
      return (
        <div style={{ position: 'fixed', inset: 0, top: TITLE_H }}>
          <Login onLogin={() => setShowLogin(false)} onBack={() => setShowLogin(false)} />
        </div>
      )
    }
    return (
      <Landing
        onSignInClick={() => setShowLogin(true)}
      />
    )
  }

  return (
    <InspectionProvider>
      <NavigationProvider>
        <BrowserRouter>
          <div style={{ position: 'fixed', inset: 0, top: TITLE_H, display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/inspection" replace />} />
                <Route path="inspection" element={<LiveInspection />} />
                <Route path="history" element={<RollHistory />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings" element={<Settings />} />
                <Route path="help" element={<Help />} />
                <Route path="audit-log" element={<AuditLog />} />
              </Route>
            </Routes>
          </div>
        </BrowserRouter>
      </NavigationProvider>
    </InspectionProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          {/* TitleBar is always on top across every screen */}
          <TitleBar />
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import HelpDrawer from '../help/HelpDrawer'
import { useAuth } from '../../context/AuthContext'
import { AlertTriangle } from 'lucide-react'

function PasswordChangeBanner() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
      background: 'rgba(245,158,11,0.12)', borderBottom: '1.5px solid rgba(245,158,11,0.3)',
      flexShrink: 0,
    }}>
      <AlertTriangle size={17} style={{ color: '#F59E0B', flexShrink: 0 }} />
      <span style={{ fontSize: 15, color: '#FCD34D', fontWeight: 500 }}>
        You are using the default admin password. Please change it immediately in{' '}
      </span>
      <button
        onClick={() => navigate('/settings')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#FCD34D', fontWeight: 700, fontSize: 15, textDecoration: 'underline', padding: 0,
        }}
      >
        Settings → User & System
      </button>
    </div>
  )
}

export default function AppShell() {
  const [helpOpen, setHelpOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onHelpOpen={() => setHelpOpen(true)} />
        {user?.force_password_change && <PasswordChangeBanner />}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
      {helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

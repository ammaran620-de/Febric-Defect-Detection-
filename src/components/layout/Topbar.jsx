import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Sun, Moon, HelpCircle, Minus, Square, X, Bell, ChevronDown, LogOut, User, Shield, Home } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useInspection } from '../../context/InspectionContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const PAGE_TITLES = {
  '/inspection': 'Live Inspection',
  '/history':    'Roll History',
  '/analytics':  'Analytics',
  '/settings':   'Settings',
  '/help':       'Help Center',
  '/audit-log':  'Audit Log',
}

const ROLE_COLORS = {
  admin:    { bg: 'rgba(239,68,68,0.15)',  color: '#F87171' },
  operator: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
  viewer:   { bg: 'rgba(16,185,129,0.15)', color: '#34D399' },
}

export default function Topbar({ onHelpOpen }) {
  const { theme, toggleTheme } = useTheme()
  const { rollState, demoMode } = useInspection()
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const loc = useLocation()
  const title = PAGE_TITLES[loc.pathname] || 'Magic QC'

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const isElectron = typeof window.electronAPI !== 'undefined'
  const roleCfg = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    toast('Signed out successfully', 'info')
  }

  return (
    <header
      className="flex items-center justify-between px-5 titlebar-drag flex-shrink-0"
      style={{ height: 54, background: 'var(--card)', borderBottom: '1.5px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 titlebar-no-drag">
        <h1 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {demoMode && (
          <span className="badge" style={{
            background: '#FEF3C7', color: '#92400E',
            border: '1px solid #FDE68A', fontSize: '0.65rem',
          }}>
            ◉ DEMO MODE
          </span>
        )}
        {rollState.isActive && (
          <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
            ● INSPECTING: {rollState.rollId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 titlebar-no-drag">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center btn-ghost border-0"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Help */}
        <button
          onClick={onHelpOpen}
          className="w-8 h-8 rounded-lg flex items-center justify-center btn-ghost border-0"
          title="Help"
        >
          <HelpCircle size={15} />
        </button>

        {/* User menu */}
        {user && (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg btn-ghost border-0"
              style={{ height: 32 }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: roleCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={11} style={{ color: roleCfg.color }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                background: roleCfg.bg, color: roleCfg.color,
                borderRadius: 20, padding: '2px 8px',
              }}>
                {user.role}
              </span>
              <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {userMenuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'var(--bg-surface)',
                border: '1.5px solid var(--border-bold)',
                borderRadius: 10, padding: '6px 0', minWidth: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                zIndex: 1000,
              }}>
                {/* User info header */}
                <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--border-default)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 1 }}>
                    @{user.username}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                    background: roleCfg.bg, borderRadius: 20, padding: '2px 8px',
                  }}>
                    <Shield size={10} style={{ color: roleCfg.color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: roleCfg.color, textTransform: 'capitalize' }}>
                      {user.role}
                    </span>
                  </div>
                </div>

                {/* Menu items */}
                <UserMenuItem
                  icon={<User size={13} />}
                  label="My Profile"
                  onClick={() => { setUserMenuOpen(false) }}
                />
                <UserMenuItem
                  icon={theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                  label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  onClick={() => { toggleTheme(); setUserMenuOpen(false) }}
                />

                <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-default)' }} />

                <UserMenuItem
                  icon={<Home size={13} />}
                  label="Back to Landing Page"
                  onClick={() => { setUserMenuOpen(false); logout(true) }}
                />
                <UserMenuItem
                  icon={<LogOut size={13} />}
                  label="Sign Out"
                  onClick={handleLogout}
                  danger
                />
              </div>
            )}
          </div>
        )}

        {false && isElectron && (
          <>
            <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
            <button onClick={() => window.electronAPI.minimize()}
              className="w-7 h-7 rounded flex items-center justify-center hover:opacity-60 transition-opacity">
              <Minus size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => window.electronAPI.maximize()}
              className="w-7 h-7 rounded flex items-center justify-center hover:opacity-60 transition-opacity">
              <Square size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => window.electronAPI.close()}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
              <X size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

function UserMenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 14px', border: 'none', background: 'none',
        cursor: 'pointer', textAlign: 'left', fontSize: 13,
        color: danger ? '#F87171' : 'var(--text-secondary)',
        fontSize: 15,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon}
      {label}
    </button>
  )
}

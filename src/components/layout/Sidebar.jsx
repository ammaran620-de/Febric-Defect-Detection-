import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  ScanLine, Clock, BarChart3, Settings, HelpCircle,
  Zap, Lock, FileText,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const ALL_NAV = [
  { to: '/inspection', icon: ScanLine,  label: 'Live Inspection', permission: 'live_inspection' },
  { to: '/history',    icon: Clock,     label: 'Roll History',    permission: 'roll_history' },
  { to: '/analytics',  icon: BarChart3, label: 'Analytics',       permission: 'analytics' },
  { to: '/settings',   icon: Settings,  label: 'Settings',        permission: 'settings_read' },
  { to: '/help',       icon: HelpCircle,label: 'Help Center',     permission: null },
]

const ADMIN_NAV = [
  { to: '/audit-log',  icon: FileText,  label: 'Audit Log',       permission: 'audit_log' },
]

const ROLE_COLORS = {
  admin:    { bg: 'rgba(239,68,68,0.15)',  color: '#F87171', dot: '#EF4444' },
  operator: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', dot: '#3B82F6' },
  viewer:   { bg: 'rgba(16,185,129,0.15)', color: '#34D399', dot: '#10B981' },
}

export default function Sidebar() {
  const { user, hasPermission } = useAuth()

  const allNavItems = [...ALL_NAV, ...(user?.role === 'admin' ? ADMIN_NAV : [])]

  const roleCfg = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0"
      style={{ width: 240, background: 'var(--card)', borderRight: '1.5px solid var(--border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-4 titlebar-drag"
        style={{ borderBottom: '1.5px solid var(--border)', minHeight: 62 }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#2563EB' }}>
          <Zap size={19} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2, color: 'var(--text-primary)' }}>
            Magic QC
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>v1.0.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-3 mb-2">
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', paddingLeft: 8, marginBottom: 6, color: 'var(--text-muted)' }}>
            Navigation
          </p>
        </div>
        {allNavItems.map(({ to, icon: Icon, label, permission }) => {
          const allowed = permission ? hasPermission(permission) : true
          if (!allowed) {
            return (
              <div
                key={to}
                className="sidebar-link"
                style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}
                title={`Requires ${permission} permission`}
              >
                <Lock size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </div>
            )
          }
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User info */}
      {user && (
        <div style={{ padding: '14px 18px', borderTop: '1.5px solid var(--border)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: roleCfg.bg, borderRadius: 20, padding: '4px 12px 4px 10px',
            marginBottom: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: roleCfg.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: roleCfg.color, textTransform: 'capitalize' }}>
              {user.role}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>
            {user.full_name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            @{user.username}
          </div>
        </div>
      )}
    </aside>
  )
}

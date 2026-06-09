import React from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const ROLE_HIERARCHY = { admin: 3, operator: 2, viewer: 1 }

export default function RoleGuard({ requiredRole, permission, children, fallback }) {
  const { user } = useAuth()
  if (!user) return null

  const allowed = permission
    ? (ROLE_HIERARCHY[user.role] || 0) >= 1 && (() => {
        const PERMISSIONS = {
          admin:    ['live_inspection','roll_history','analytics','settings_read','settings_write','user_management','delete_rolls','audit_log'],
          operator: ['live_inspection','roll_history','analytics','settings_read'],
          viewer:   ['roll_history','analytics'],
        }
        return (PERMISSIONS[user.role] || []).includes(permission)
      })()
    : (ROLE_HIERARCHY[user.role] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0)

  if (allowed) return children

  return fallback !== undefined ? fallback : (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12, color: 'var(--text-muted)',
    }}>
      <Lock size={32} strokeWidth={1.5} />
      <p style={{ fontSize: 14, margin: 0 }}>
        This feature requires <strong>{requiredRole || permission}</strong> access
      </p>
    </div>
  )
}

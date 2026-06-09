import React, { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, Filter } from 'lucide-react'
import { format } from 'date-fns'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ACTION_COLORS = {
  LOGIN:           { bg: 'rgba(16,185,129,0.1)',  color: '#34D399' },
  LOGOUT:          { bg: 'rgba(148,163,184,0.1)', color: '#94A3B8' },
  ROLL_START:      { bg: 'rgba(59,130,246,0.1)',  color: '#60A5FA' },
  ROLL_FINISH:     { bg: 'rgba(16,185,129,0.1)',  color: '#34D399' },
  ROLL_ABORT:      { bg: 'rgba(245,158,11,0.1)',  color: '#FCD34D' },
  ROLL_DELETED:    { bg: 'rgba(239,68,68,0.1)',   color: '#FCA5A5' },
  SETTINGS_CHANGE: { bg: 'rgba(139,92,246,0.1)',  color: '#C4B5FD' },
  USER_CREATED:    { bg: 'rgba(16,185,129,0.1)',  color: '#34D399' },
  USER_UPDATED:    { bg: 'rgba(59,130,246,0.1)',  color: '#60A5FA' },
  USER_DELETED:    { bg: 'rgba(239,68,68,0.1)',   color: '#FCA5A5' },
  PASSWORD_CHANGE: { bg: 'rgba(139,92,246,0.1)',  color: '#C4B5FD' },
  FORCE_LOGOUT:    { bg: 'rgba(245,158,11,0.1)',  color: '#FCD34D' },
}

function ActionBadge({ action }) {
  const cfg = ACTION_COLORS[action] || { bg: 'rgba(148,163,184,0.1)', color: '#94A3B8' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 13, fontWeight: 700, letterSpacing: '0.5px',
      padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  )
}

export default function AuditLog() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems]       = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [filterUser, setFilterUser]     = useState('')
  const [filterAction, setFilterAction] = useState('')

  const PAGE_SIZE = 50

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/audit-log', {
        params: {
          page, page_size: PAGE_SIZE,
          username: filterUser || undefined,
          action:   filterAction || undefined,
        }
      })
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      toast('Failed to load audit log', 'error')
      setItems(DEMO_ITEMS)
      setTotal(DEMO_ITEMS.length)
    } finally {
      setLoading(false)
    }
  }, [page, filterUser, filterAction, toast])

  useEffect(() => { fetchLog() }, [fetchLog])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const exportCSV = () => {
    const rows = [['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Details', 'IP']]
    items.forEach(i => rows.push([
      i.created_at, i.username, i.action, i.entity || '', i.entity_id || '',
      i.details || '', i.ip_address || '',
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `audit-log-${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
    toast('Audit log exported', 'success')
  }

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontSize: 36 }}>🔒</span>
        <p style={{ fontSize: 14 }}>Audit Log is only accessible to administrators</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Header */}
      <div className="card card--neutral" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <span className="section-label">Audit Log</span>
        <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{total} records</span>

        <div style={{ flex: 1 }} />

        {/* Filters */}
        <input
          type="text" placeholder="Filter by user…" value={filterUser}
          onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          className="input" style={{ width: 160, height: 38, fontSize: 15 }}
        />
        <select
          value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="input" style={{ width: 170, height: 38, fontSize: 15, padding: '0 10px' }}
        >
          <option value="">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <button onClick={fetchLog} className="btn btn-ghost" style={{ height: 38, padding: '0 12px' }}>
          <RefreshCw size={15} />
        </button>
        <button onClick={exportCSV} className="btn btn-ghost" style={{ height: 38, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', fontSize: 15 }}>
          <Download size={15} /> Export
        </button>
      </div>

      {/* Table */}
      <div className="card flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="flex-1 overflow-y-auto table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Time</th>
                <th style={{ width: 110 }}>User</th>
                <th style={{ width: 150 }}>Action</th>
                <th style={{ width: 90 }}>Entity</th>
                <th style={{ width: 120 }}>Entity ID</th>
                <th>Details</th>
                <th style={{ width: 100 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No audit records found</td></tr>
              )}
              {!loading && items.map((item, i) => (
                <tr key={i}>
                  <td className="data-value" style={{ whiteSpace: 'nowrap' }}>
                    {item.created_at ? format(new Date(item.created_at), 'MMM d, HH:mm:ss') : '—'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.username || '—'}
                    </span>
                  </td>
                  <td><ActionBadge action={item.action} /></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{item.entity || '—'}</td>
                  <td className="data-value">{item.entity_id || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.details || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderTop: '1.5px solid var(--border-default)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost"
              style={page === 1 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >← Prev</button>
            <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-ghost"
              style={page === totalPages ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

const DEMO_ITEMS = [
  { created_at: new Date().toISOString(), username: 'admin', action: 'LOGIN', entity: 'session', entity_id: null, details: 'IP: 127.0.0.1', ip_address: '127.0.0.1' },
  { created_at: new Date(Date.now() - 3e5).toISOString(), username: 'operator_1', action: 'ROLL_FINISH', entity: 'roll', entity_id: 'ROLL-20260514-001', details: 'result=PASSED', ip_address: '127.0.0.1' },
  { created_at: new Date(Date.now() - 6e5).toISOString(), username: 'admin', action: 'SETTINGS_CHANGE', entity: 'config', entity_id: null, details: "['acceptance_threshold']", ip_address: '127.0.0.1' },
  { created_at: new Date(Date.now() - 9e5).toISOString(), username: 'operator_1', action: 'ROLL_START', entity: 'roll', entity_id: 'ROLL-20260514-001', details: null, ip_address: '127.0.0.1' },
]

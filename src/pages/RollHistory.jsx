import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Eye, Download, Trash2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 20

export default function RollHistory() {
  const { toast } = useToast()
  const [rolls, setRolls] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedRoll, setSelectedRoll] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchRolls = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        search: search || undefined,
        result: resultFilter !== 'ALL' ? resultFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }
      const res = await api.get('/rolls', { params })
      setRolls(res.data.items || res.data || [])
      setTotal(res.data.total || (res.data?.length ?? 0))
    } catch {
      // Demo fallback
      setRolls(DEMO_ROLLS)
      setTotal(DEMO_ROLLS.length)
    } finally {
      setLoading(false)
    }
  }, [page, search, resultFilter, dateFrom, dateTo])

  useEffect(() => { fetchRolls() }, [fetchRolls])

  const handleDelete = async (rollId) => {
    try {
      await api.delete(`/rolls/${rollId}`)
      toast('Roll deleted', 'success')
      fetchRolls()
    } catch {
      toast('Delete failed', 'error')
    }
    setDeleteConfirm(null)
  }

  const handleExportCSV = async (roll) => {
    try {
      const res = await api.get(`/rolls/${roll.id}/export`)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${roll.roll_id}-report.csv`
      a.click()
      toast('CSV exported', 'success')
    } catch {
      toast('Export failed', 'warning')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="card card--neutral p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input pl-8"
              placeholder="Search Roll ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          <select
            className="input"
            style={{ width: 140 }}
            value={resultFilter}
            onChange={e => { setResultFilter(e.target.value); setPage(1) }}
          >
            <option value="ALL">All Results</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="ABORTED">Aborted</option>
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>From</label>
            <input type="date" className="input" style={{ width: 140 }} value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>To</label>
            <input type="date" className="input" style={{ width: 140 }} value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }} />
          </div>

          {(search || resultFilter !== 'ALL' || dateFrom || dateTo) && (
            <button
              className="btn btn-ghost py-1.5 px-3 text-xs"
              onClick={() => { setSearch(''); setResultFilter('ALL'); setDateFrom(''); setDateTo(''); setPage(1) }}
            >
              <X size={12} /> Clear
            </button>
          )}

          <div className="flex-1" />
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {total} rolls
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card card--neutral flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-auto table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Operator</th>
                <th>Length (m)</th>
                <th>Total Pts</th>
                <th>Pts/100sqyd</th>
                <th>Threshold</th>
                <th>Result</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : rolls.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No rolls found</td></tr>
              ) : rolls.map(roll => (
                <tr key={roll.id} className="group" style={{ borderLeft: roll.result === 'FAILED' ? '2px solid var(--accent-danger)' : '2px solid transparent' }}>
                  <td className="data-value text-xs font-semibold">{roll.roll_id}</td>
                  <td className="data-value text-xs">{roll.start_time ? format(parseISO(roll.start_time), 'dd MMM yyyy') : '—'}</td>
                  <td className="data-value text-xs">{roll.start_time ? format(parseISO(roll.start_time), 'HH:mm:ss') : '—'}</td>
                  <td className="text-xs">{roll.operator || '—'}</td>
                  <td className="data-value text-xs">{(roll.fabric_length_m ?? 0).toFixed(2)}</td>
                  <td className="data-value text-xs font-bold">{roll.total_points ?? 0}</td>
                  <td className="data-value text-xs">{(roll.points_per_100sqyd ?? 0).toFixed(2)}</td>
                  <td className="data-value text-xs">{roll.threshold_used ?? 40}</td>
                  <td>
                    <ResultBadge result={roll.result} />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedRoll(roll)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="View"
                      >
                        <Eye size={13} style={{ color: 'var(--accent-primary)' }} />
                      </button>
                      <button
                        onClick={() => handleExportCSV(roll)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                        title="Export CSV"
                      >
                        <Download size={13} style={{ color: 'var(--accent-success)' }} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(roll)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 size={13} style={{ color: 'var(--accent-danger)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost py-1 px-2"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i))
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`btn py-1 px-3 ${page === p ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minWidth: 32 }}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-ghost py-1 px-2"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {selectedRoll && (
        <RollDetailModal roll={selectedRoll} onClose={() => setSelectedRoll(null)} />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-panel w-full max-w-sm p-6">
            <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>Confirm Delete</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Delete roll <strong>{deleteConfirm.roll_id}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger flex-1 justify-center" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultBadge({ result }) {
  if (result === 'PASSED') {
    return <span className="badge badge-green">✓ PASSED</span>
  }
  if (result === 'FAILED') {
    return <span className="badge badge-red">✗ FAILED</span>
  }
  if (result === 'INSPECTING') {
    return (
      <span className="badge badge-blue">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-1" />
        INSPECTING
      </span>
    )
  }
  return <span className={`badge badge-gray`}>{result || 'UNKNOWN'}</span>
}

function RollDetailModal({ roll, onClose }) {
  const [defects, setDefects] = useState([])
  useEffect(() => {
    api.get(`/rolls/${roll.id}`)
      .then(r => setDefects(r.data.defects || []))
      .catch(() => setDefects([]))
  }, [roll.id])

  return (
    <div className="modal-overlay">
      <div className="modal-panel w-full max-w-2xl" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1.5px solid var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{roll.roll_id}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Roll Detail & Defect Report</p>
          </div>
          <div className="flex items-center gap-3">
            <ResultBadge result={roll.result} />
            <button onClick={onClose} className="btn btn-ghost py-1 px-2"><X size={14} /></button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              ['Operator', roll.operator],
              ['Start Time', roll.start_time ? format(parseISO(roll.start_time), 'dd MMM yyyy HH:mm') : '—'],
              ['Fabric Length', `${(roll.fabric_length_m ?? 0).toFixed(2)} m`],
              ['Total Points', roll.total_points ?? 0],
              ['Points/100sqyd', (roll.points_per_100sqyd ?? 0).toFixed(2)],
              ['Threshold', roll.threshold_used ?? 40],
            ].map(([label, value]) => (
              <div key={label} className="card p-3">
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="font-mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            Defects ({defects.length})
          </h4>
          <div className="table-container" style={{ maxHeight: 280 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Time</th><th>Type</th><th>Length (in)</th><th>Points</th><th>Pos X</th><th>Pos Y</th>
                </tr>
              </thead>
              <tbody>
                {defects.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>No defects recorded</td></tr>
                ) : defects.map((d, i) => (
                  <tr key={i}>
                    <td className="font-mono">{i + 1}</td>
                    <td className="font-mono text-xs">{d.detected_at ? format(parseISO(d.detected_at), 'HH:mm:ss') : '—'}</td>
                    <td><span className="badge badge-gray text-xs">{d.defect_type}</span></td>
                    <td className="font-mono">{(d.length_inches ?? 0).toFixed(2)}"</td>
                    <td className="font-mono font-bold">{d.penalty_points}</td>
                    <td className="font-mono text-xs">{(d.position_x ?? 0).toFixed(1)}</td>
                    <td className="font-mono text-xs">{(d.position_y ?? 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Demo data for offline mode
const DEMO_ROLLS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  roll_id: `ROLL-20260508-${String(i + 1).padStart(3, '0')}`,
  operator: 'Demo Operator',
  start_time: new Date(Date.now() - i * 3600000).toISOString(),
  fabric_length_m: 80 + Math.random() * 50,
  total_points: Math.floor(Math.random() * 60),
  points_per_100sqyd: Math.random() * 60,
  threshold_used: 40,
  result: Math.random() > 0.3 ? 'PASSED' : 'FAILED',
}))

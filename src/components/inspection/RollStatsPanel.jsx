import React, { useEffect, useRef } from 'react'
import { useInspection } from '../../context/InspectionContext'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Download, Check, X, Play } from 'lucide-react'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'

const WS_STATS_URL = 'ws://127.0.0.1:8000/ws/stats'

const STATUS_CFG = {
  IDLE:        { label: 'IDLE',        cls: 'badge-gray' },
  INSPECTING:  { label: 'INSPECTING',  cls: 'badge-blue', icon: 'animate-pulse' },
  PASSED:      { label: 'PASSED',      cls: 'badge-green', icon: '✓' },
  FAILED:      { label: 'FAILED',      cls: 'badge-red', icon: '✗' },
}

export default function RollStatsPanel() {
  const { rollState, startRoll, finishRoll, abortRoll, updateStats } = useInspection()
  const { toast } = useToast()
  const wsRef = useRef(null)

  // Stats WebSocket
  useEffect(() => {
    let ws = null
    let retry = null

    const connect = () => {
      ws = new WebSocket(WS_STATS_URL)
      wsRef.current = ws
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          updateStats(data)
        } catch {}
      }
      ws.onclose = () => { retry = setTimeout(connect, 3000) }
    }

    connect()
    return () => {
      clearTimeout(retry)
      ws?.close()
    }
  }, [updateStats])

  const {
    rollId, status, fabricLength, totalPoints,
    pointsPer100sqyd, threshold, defects, isActive
  } = rollState

  const pct = threshold > 0 ? Math.min((totalPoints / threshold) * 100, 100) : 0
  const statusCfg = STATUS_CFG[status] || STATUS_CFG.IDLE

  const exportCSV = async () => {
    try {
      const res = await api.get(`/rolls/${rollState.dbRollId || rollId}/export`)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rollId}-defects.csv`
      a.click()
      toast('CSV exported', 'success')
    } catch {
      toast('Export failed — backend offline', 'warning')
    }
  }
  
  const cardBorderClass = isActive ? 'var(--accent-success)' : 'var(--accent-primary)'

  return (
    <div className={`flex flex-col h-full overflow-hidden w-full`} style={{ background: 'var(--bg-surface)', borderLeft: `2px solid ${cardBorderClass}` }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1.5px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Roll Statistics</span>
          <span className={`badge ${statusCfg.cls}`}>
            {statusCfg.icon === 'animate-pulse' ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1"></span> : statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Roll ID</span>
          <span className="data-value">{rollId || '—'}</span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span style={{ color: 'var(--text-secondary)' }}>Operator</span>
          <span className="data-value">Default Operator</span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1.5px solid var(--border-default)' }}>
        <div className="section-label mb-2">Fabric Metrics</div>
        <StatRow label="Inspected" value={`${fabricLength.toFixed(2)} m`} />
        <StatRow label="Total Points" value={totalPoints} highlight={totalPoints >= threshold} />
        <StatRow label="Pts / 100 sq yd" value={pointsPer100sqyd.toFixed(2)} highlight={pointsPer100sqyd >= threshold} />
        <StatRow label="Threshold" value={`${threshold} pts`} />
      </div>

      {/* Progress */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1.5px solid var(--border-default)' }}>
        <div className="section-label mb-2">Penalty Progress</div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="progress-bar flex-1 mr-3">
            <div
              className="progress-fill"
              style={{
                width: `${pct}%`,
                background: pct >= 80 ? 'var(--accent-danger)' : pct >= 61 ? 'var(--accent-warn)' : 'var(--accent-success)',
                boxShadow: pct >= 80 ? '0 0 8px var(--accent-danger)' : 'none'
              }}
            />
          </div>
          <span className="data-value text-xs" style={{
            color: pct >= 80 ? 'var(--accent-danger)' : pct >= 61 ? 'var(--accent-warn)' : 'var(--accent-success)'
          }}>
            {pct.toFixed(0)}% {pct >= 80 ? '⚠' : ''}
          </span>
        </div>
      </div>

      {/* Defect Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1.5px solid var(--border-default)' }}>
          <span className="section-label">Defect Log ({defects.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto table-container" style={{ maxHeight: 200 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Type</th>
                <th>In</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {defects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No defects detected
                  </td>
                </tr>
              ) : (
                defects.slice(0, 100).map((d, i) => (
                  <tr key={i}>
                    <td className="data-value">{d.index || i + 1}</td>
                    <td className="data-value">
                      {d.detected_at ? format(new Date(d.detected_at), 'HH:mm:ss') : '—'}
                    </td>
                    <td>
                      <DefectTypeBadge type={d.defect_type} />
                    </td>
                    <td className="data-value">
                      {(d.length_inches ?? 0).toFixed(1)}"
                    </td>
                    <td>
                      <span className={`data-value ${d.penalty_points >= 4 ? 'text-red-500' : d.penalty_points >= 3 ? 'text-amber-500' : ''}`}>
                        {d.penalty_points ?? 0}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1.5px solid var(--border-default)' }}>
        {!isActive ? (
          <button onClick={startRoll} className="btn btn-primary w-full justify-center">
            <Play size={14} /> Start New Roll
          </button>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => finishRoll()}
                className="btn btn-success flex-1 justify-center"
                title="Finish and save this roll"
              >
                <Check size={15} /> Finish Roll
              </button>
              <button
                onClick={abortRoll}
                className="btn btn-danger flex-1 justify-center"
                title="Abort and discard this roll"
              >
                <X size={15} /> Abort
              </button>
            </div>
            <button
              onClick={exportCSV}
              disabled={defects.length === 0}
              title={defects.length === 0 ? 'No defects to export yet' : 'Export defect log as CSV'}
              className="btn btn-ghost w-full justify-center"
              style={defects.length === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <Download size={15} /> Export CSV
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: highlight ? 'var(--accent-danger)' : 'var(--text-value)' }}>
        {value}
      </span>
    </div>
  )
}

const DEFECT_COLORS = {
  Hole:           { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' },
  Stain:          { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warn)' },
  'Weft Break':   { bg: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)' },
  'Warp Break':   { bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' },
  'Running Defect': { bg: 'rgba(234, 88, 12, 0.1)', color: '#EA580C' },
  Splice:         { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' },
  Unknown:        { bg: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)' },
}

function DefectTypeBadge({ type }) {
  const cfg = DEFECT_COLORS[type] || DEFECT_COLORS.Unknown
  return (
    <span
      className="px-1.5 py-0.5 rounded font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontSize: '13px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6 }}
    >
      {type || 'Unknown'}
    </span>
  )
}

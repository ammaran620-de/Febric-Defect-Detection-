import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Download, RefreshCw, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { format, subDays } from 'date-fns'
import { useToast } from '../context/ToastContext'

const SHIFTS = [
  { label: 'All Shifts', value: 'all' },
  { label: 'Morning (06–14)', value: 'morning' },
  { label: 'Evening (14–22)', value: 'evening' },
  { label: 'Night (22–06)',   value: 'night' },
]

const REFRESH_INTERVAL = 30

// ── Sparkline (tiny 7-day mini chart) ─────────────────────────────────────────
function Sparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return <div style={{ height: 40 }} />
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── OEE Quality Gauge (SVG arc) ───────────────────────────────────────────────
function QualityGauge({ value }) {
  const color = value >= 95 ? '#10B981' : value >= 85 ? '#F59E0B' : '#EF4444'
  const label = value >= 95 ? 'EXCELLENT' : value >= 85 ? 'ACCEPTABLE' : 'CRITICAL'

  const r = 52
  const cx = 70, cy = 70
  const startAngle = Math.PI * 0.8
  const endAngle = Math.PI * 2.2
  const totalArc = endAngle - startAngle
  const fillArc = totalArc * (value / 100)

  const arcPath = (from, to, radius) => {
    const x1 = cx + radius * Math.cos(from)
    const y1 = cy + radius * Math.sin(from)
    const x2 = cx + radius * Math.cos(to)
    const y2 = cy + radius * Math.sin(to)
    const largeArc = (to - from) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <svg width={140} height={100} viewBox="0 0 140 100">
        {/* Track */}
        <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="var(--border-default)" strokeWidth={10} strokeLinecap="round" />
        {/* Fill */}
        <path d={arcPath(startAngle, startAngle + fillArc, r)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        {/* Value */}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={22} fontWeight={700}
          fill={color} fontFamily="JetBrains Mono, monospace">{value}%</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fontWeight={600}
          fill="var(--text-muted)" letterSpacing={1}>{label}</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: -8 }}>
        Quality Rate
      </div>
    </div>
  )
}

// ── Defect Heatmap ─────────────────────────────────────────────────────────────
function DefectHeatmap({ data }) {
  const [tooltip, setTooltip] = useState(null)
  if (!data) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading heatmap...</div>

  const { grid, max_count } = data
  if (!grid || max_count === 0) {
    return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No defect data for selected range</div>
  }

  const COLS = grid[0]?.length || 20
  const ROWS = grid.length || 10
  const FABRIC_WIDTH_IN = 53.94

  const cellColor = (val) => {
    if (val === 0) return 'transparent'
    if (val < 0.33) return `rgba(245,158,11,${0.2 + val * 0.8})`
    if (val < 0.66) return `rgba(234,88,12,${0.3 + val * 0.7})`
    return `rgba(239,68,68,${0.4 + val * 0.6})`
  }

  const inchesPerCol = FABRIC_WIDTH_IN / COLS

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 1.5, padding: '0 4px' }}>
        {grid.map((row, ri) =>
          row.map((val, ci) => {
            const count = Math.round(val * max_count)
            return (
              <div
                key={`${ri}-${ci}`}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, count, col: ci, row: ri })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  height: 14,
                  background: cellColor(val),
                  borderRadius: 2,
                  border: val > 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border-default)',
                  cursor: count > 0 ? 'pointer' : 'default',
                  transition: 'transform 0.1s',
                }}
                onMouseOver={e => { if (count > 0) e.currentTarget.style.transform = 'scaleY(1.3)' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)' }}
              />
            )
          })
        )}
      </div>
      {/* X axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px 0', marginTop: 4 }}>
        {[0, Math.floor(COLS / 4), Math.floor(COLS / 2), Math.floor(3 * COLS / 4), COLS - 1].map(i => (
          <span key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {(i * inchesPerCol).toFixed(0)}"
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
        Width position (inches) ← fabric width 53.94" →
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
          <div key={v} style={{ width: 18, height: 10, borderRadius: 2, background: cellColor(v) }} />
        ))}
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>High</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 10, top: tooltip.y - 10,
          background: 'var(--bg-surface)', border: '1px solid var(--border-bold)',
          borderRadius: 6, padding: '7px 12px', fontSize: 14, color: 'var(--text-primary)',
          pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {tooltip.count} defect{tooltip.count !== 1 ? 's' : ''} — zone ({tooltip.col + 1}, {tooltip.row + 1})
        </div>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sublabel, borderColor, trend, sparkData, sparkKey }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1.5px solid var(--border-bold)',
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '16px 18px 12px',
      minHeight: '130px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        {trend && (
          <span style={{ color: trend === 'up' ? '#10B981' : '#EF4444' }}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </span>
        )}
      </div>
      <span style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: borderColor, lineHeight: 1, marginTop: 4 }}>
        {value}
      </span>
      {sparkData && <Sparkline data={sparkData} dataKey={sparkKey || 'total'} color={borderColor} />}
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: 4 }}>{sublabel}</span>
    </div>
  )
}

// ── Main Analytics Page ───────────────────────────────────────────────────────
export default function Analytics() {
  const { toast } = useToast()
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState([])
  const [defectFreq, setDefectFreq] = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 14), 'yyyy-MM-dd'))
  const [dateTo, setDateTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [shift, setShift]       = useState('all')
  const [loading, setLoading]   = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [exportState, setExportState] = useState('idle') // idle | generating | done
  const countdownRef = useRef(null)
  const exportPollRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = { date_from: dateFrom, date_to: dateTo, shift: shift !== 'all' ? shift : undefined }
    try {
      const [sumRes, trendRes, heatRes] = await Promise.all([
        api.get('/analytics/summary', { params }),
        api.get('/analytics/trends',  { params }),
        api.get('/analytics/heatmap', { params }),
      ])
      setSummary(sumRes.data)
      setTrends(trendRes.data.daily_rolls || [])
      setDefectFreq(trendRes.data.defect_frequency || [])
      setHeatmap(heatRes.data)
    } catch {
      setSummary(DEMO_SUMMARY)
      setTrends(DEMO_TRENDS)
      setDefectFreq(DEMO_DEFECT_FREQ)
      setHeatmap(DEMO_HEATMAP)
    } finally {
      setLoading(false)
      setCountdown(REFRESH_INTERVAL)
    }
  }, [dateFrom, dateTo, shift])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Countdown ticker
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1))
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [])

  const handleExportCSV = async () => {
    setExportState('generating')
    toast('Preparing CSV…', 'info')
    try {
      const res = await api.get('/analytics/export-csv', {
        params: { date_from: dateFrom, date_to: dateTo },
      })
      const { export_id } = res.data
      exportPollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/exports/${export_id}`, { responseType: 'blob' })
          if (statusRes.headers['content-type']?.includes('csv')) {
            clearInterval(exportPollRef.current)
            const url = URL.createObjectURL(statusRes.data)
            const a = document.createElement('a')
            a.href = url; a.download = `fabricguard_${export_id}.csv`; a.click()
            setExportState('done')
            toast('CSV downloaded', 'success')
            setTimeout(() => setExportState('idle'), 3000)
          }
        } catch {}
      }, 500)
      setTimeout(() => {
        clearInterval(exportPollRef.current)
        if (exportState === 'generating') {
          setExportState('idle')
          toast('Export timed out — try a smaller date range', 'error')
        }
      }, 30000)
    } catch {
      setExportState('idle')
      toast('Export failed', 'error')
    }
  }

  const s = summary || DEMO_SUMMARY
  const passRate = s.pass_rate_today ?? (s.total_today > 0 ? Math.round((s.passed_today / s.total_today) * 100) : 0)
  const pieData = [
    { name: 'Passed', value: s.total_passed || 0 },
    { name: 'Failed', value: s.total_failed || 0 },
  ]

  const sparklines = s.sparklines
    ? Object.entries(s.sparklines).map(([date, v]) => ({ date, ...v }))
    : DEMO_SPARKLINES

  const tooltipStyle = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-bold)',
    fontSize: 12, borderRadius: 8, color: 'var(--text-primary)',
  }

  const now = new Date().toLocaleTimeString()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', padding: '0 0 16px' }}>

      {/* Control Bar */}
      <div className="card card--neutral" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <span className="section-label" style={{ color: 'var(--text-secondary)' }}>Analytics Control Center</span>

        {/* Shift filter */}
        <select
          value={shift} onChange={e => setShift(e.target.value)}
          className="input" style={{ width: 170, height: 38, fontSize: 15, padding: '0 10px' }}
        >
          {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <input type="date" className="input" style={{ width: 150, height: 38, fontSize: 15 }}
          value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>to</span>
        <input type="date" className="input" style={{ width: 150, height: 38, fontSize: 15 }}
          value={dateTo} onChange={e => setDateTo(e.target.value)} />

        <button onClick={fetchData} className="btn btn-primary" style={{ height: 38 }}>Apply</button>

        <div style={{ flex: 1 }} />

        {/* Live indicator + countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Live · Next refresh in {countdown}s · Updated {now}
          </span>
        </div>

        {loading && <RefreshCw size={14} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />}

        <button
          onClick={handleExportCSV}
          disabled={exportState === 'generating'}
          className="btn btn-ghost py-1 px-3 text-xs"
          style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={13} />
          {exportState === 'generating' ? 'Preparing…' : exportState === 'done' ? '✓ Done' : 'Export CSV'}
        </button>
      </div>

      {/* KPI Row: 8 cards + OEE gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) 140px', gap: 10 }}>
        <KPICard label="Rolls Today"      value={s.total_today ?? 0}        sublabel="Total inspected"      borderColor="#3B82F6"
          trend={s.total_today > (s.total_yesterday ?? 0) ? 'up' : null}
          sparkData={sparklines} sparkKey="total" />
        <KPICard label="Passed Today"     value={s.passed_today ?? 0}       sublabel="Accepted rolls"       borderColor="#10B981" sparkData={sparklines} sparkKey="passed" />
        <KPICard label="Failed Today"     value={s.failed_today ?? 0}       sublabel="Rejected rolls"       borderColor="#EF4444" sparkData={sparklines} sparkKey="failed" />
        <KPICard label="Pass Rate"        value={`${passRate}%`}            sublabel={`Yesterday: ${s.pass_rate_yesterday ?? 0}%`} borderColor="#F59E0B"
          trend={passRate >= (s.pass_rate_yesterday ?? 50) ? 'up' : 'down'}
          sparkData={sparklines} sparkKey="pass_rate" />
        <KPICard label="Defects"          value={s.defects_today ?? 0}      sublabel="Detected today"       borderColor="#8B5CF6" sparkData={sparklines} sparkKey="defects" />
        <KPICard label="Avg Pts/Roll"     value={(s.avg_pts_per_roll ?? 0).toFixed(1)} sublabel="vs threshold: 40" borderColor="#EC4899" />
        <KPICard label="Fabric Inspected" value={`${(s.fabric_inspected_today ?? 0).toFixed(0)}m`} sublabel="Meters today" borderColor="#06B6D4" />
        <KPICard label="Operators"        value={s.active_operators ?? 0}   sublabel="Active today"         borderColor="#84CC16" />
        {/* OEE Gauge */}
        <div className="card card--neutral" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
          <QualityGauge value={passRate} />
        </div>
      </div>

      {/* Charts Row 1: bar (2fr) + donut (1fr) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="card card--neutral p-4" style={{ minHeight: 280 }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Rolls Per Day (14 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trends.slice(-14)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d?.slice(5) || ''} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="passed" name="Passed" fill="#10B981" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card--neutral p-4" style={{ minHeight: 280, position: 'relative' }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Pass / Fail Ratio</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                paddingAngle={3} dataKey="value" isAnimationActive>
                <Cell fill="#10B981" />
                <Cell fill="#EF4444" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '47%', left: '50%', transform: 'translate(-50%, -10%)', textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>{passRate}%</span>
          </div>
        </div>
      </div>

      {/* Charts Row 2: quality trend + defect heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card card--neutral p-4" style={{ minHeight: 280 }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Avg Penalty Points / Roll (30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trends} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d?.slice(5) || ''} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="avg_points" name="Avg Points" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="threshold" name="Threshold" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card card--neutral p-4" style={{ minHeight: 280 }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Defect Position Heatmap</h3>
          <DefectHeatmap data={heatmap} />
        </div>
      </div>

      {/* Charts Row 3: top defects + operators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card card--neutral p-4" style={{ minHeight: 260 }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Top 5 Defect Types</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={defectFreq.slice(0, 5)} margin={{ top: 4, right: 8, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis dataKey="defect_type" type="category" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={90} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Count" fill="#F59E0B" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card--neutral p-4" style={{ minHeight: 260 }}>
          <h3 className="section-label mb-3" style={{ color: 'var(--text-primary)' }}>Operator Performance</h3>
          <OperatorTable dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function OperatorTable({ dateFrom, dateTo }) {
  const [data, setData] = useState([])
  useEffect(() => {
    api.get('/analytics/operators', { params: { date_from: dateFrom, date_to: dateTo } })
      .then(r => setData(r.data.operators || []))
      .catch(() => setData(DEMO_OPERATORS))
  }, [dateFrom, dateTo])

  return (
    <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Operator</th>
            <th>Total</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Avg Pts</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No data</td></tr>
          ) : data.map((op, i) => (
            <tr key={i}>
              <td>{op.operator}</td>
              <td className="data-value">{op.total}</td>
              <td style={{ color: '#10B981' }}>{op.passed}</td>
              <td style={{ color: '#EF4444' }}>{op.failed}</td>
              <td className="data-value">{(op.avg_pts || 0).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_SUMMARY = {
  total_today: 8, passed_today: 6, failed_today: 2,
  total_passed: 124, total_failed: 31,
  pass_rate_today: 75, pass_rate_yesterday: 72,
  defects_today: 47, avg_pts_per_roll: 28.4,
  fabric_inspected_today: 340, active_operators: 3,
  sparklines: null,
}

const DEMO_TRENDS = Array.from({ length: 30 }, (_, i) => {
  const d = subDays(new Date(), 29 - i)
  const passed = Math.floor(Math.random() * 8) + 2
  const failed = Math.floor(Math.random() * 3)
  return {
    date: format(d, 'yyyy-MM-dd'), passed, failed,
    total: passed + failed,
    avg_points: Math.floor(Math.random() * 35) + 10,
    threshold: 40,
  }
})

const DEMO_DEFECT_FREQ = [
  { defect_type: 'Weft Break', count: 48 },
  { defect_type: 'Stain', count: 32 },
  { defect_type: 'Hole', count: 21 },
  { defect_type: 'Warp Break', count: 15 },
  { defect_type: 'Running Defect', count: 9 },
]

const DEMO_HEATMAP = {
  grid: Array.from({ length: 10 }, (_, r) =>
    Array.from({ length: 20 }, (_, c) => Math.random() * (r < 3 || c < 3 ? 0.3 : 0.8))
  ),
  max_count: 12,
  total_defects: 120,
}

const DEMO_SPARKLINES = Array.from({ length: 7 }, (_, i) => ({
  date: format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'),
  total: Math.floor(Math.random() * 10) + 2,
  passed: Math.floor(Math.random() * 8) + 1,
  failed: Math.floor(Math.random() * 3),
  pass_rate: Math.floor(Math.random() * 30) + 65,
  defects: Math.floor(Math.random() * 20) + 5,
}))

const DEMO_OPERATORS = [
  { operator: 'Ali Khan', total: 12, passed: 10, failed: 2, avg_pts: 24.3 },
  { operator: 'Sara Ahmed', total: 8, passed: 7, failed: 1, avg_pts: 18.7 },
  { operator: 'Default Operator', total: 5, passed: 3, failed: 2, avg_pts: 38.1 },
]

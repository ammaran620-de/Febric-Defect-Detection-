import React, { useState, useEffect, useCallback } from 'react'
import {
  Sliders, Camera, ScrollText, User, Users,
  Wifi, Trash2, Save, AlertTriangle, CheckCircle,
  Plus, Edit2, Trash, ToggleLeft, ToggleRight, X, Eye, EyeOff,
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '../context/NavigationContext'
import { useAuth } from '../context/AuthContext'

const BASE_TABS = [
  { id: 'standards', label: 'Inspection Standards', icon: Sliders },
  { id: 'camera',    label: 'Camera Settings',      icon: Camera },
  { id: 'roll',      label: 'Roll Management',       icon: ScrollText },
  { id: 'system',    label: 'User & System',         icon: User },
]
const ADMIN_TABS = [
  { id: 'users',     label: 'User Management',       icon: Users },
]

const DEFAULT_CONFIG = {
  acceptance_threshold: '40',
  fabric_width_m: '1.37',
  min_defect_area_px: '50',
  camera_mode: 'demo',
  camera_ip: '192.168.1.100',
  exposure_time: '5000',
  gain: '1.0',
  line_rate: '10000',
  roll_prefix: 'ROLL',
  auto_finish_enabled: 'false',
  auto_finish_meters: '200',
  warn_threshold_pct: '80',
  factory_name: 'My Factory',
  operator_name: 'Default Operator',
  data_path: './data',
  theme: 'dark',
  penalty_1pt: '3',
  penalty_2pt: '6',
  penalty_3pt: '9',
}

export default function Settings() {
  const { activeSettingsTab, setActiveSettingsTab } = useNavigation()
  const { user: authUser } = useAuth()
  const TABS = authUser?.role === 'admin' ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [savedFields, setSavedFields] = useState({})
  const [saving, setSaving] = useState(false)

  // Camera test state
  const [cameraStatus, setCameraStatus] = useState(null) // null | 'connected' | 'failed' | 'testing'
  const [cameraError, setCameraError] = useState('')

  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearConfirm2, setClearConfirm2] = useState(false)
  const { toast } = useToast()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    api.get('/config')
      .then(r => setConfig({ ...DEFAULT_CONFIG, ...r.data }))
      .catch(() => {})
  }, [])

  const save = useCallback(async (updates = {}) => {
    const merged = { ...config, ...updates }
    setConfig(merged)
    setSaving(true)
    try {
      await api.put('/config', merged)
      toast('Settings saved', 'success')
      // Flash all fields as saved briefly
      const keys = Object.keys(merged)
      setSavedFields(Object.fromEntries(keys.map(k => [k, true])))
      setTimeout(() => setSavedFields({}), 2000)
    } catch {
      toast('Saved locally (backend offline)', 'info')
    } finally {
      setSaving(false)
    }
  }, [config, toast])

  const saveSingle = useCallback(async (key, value) => {
    setConfig(c => ({ ...c, [key]: value }))
    try {
      await api.put('/config', { [key]: value })
      setSavedFields(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setSavedFields(prev => ({ ...prev, [key]: false })), 2000)
    } catch {}
  }, [])

  const field = (key) => ({
    value: config[key] ?? '',
    onChange: e => setConfig(c => ({ ...c, [key]: e.target.value })),
  })

  const testCamera = async () => {
    setCameraStatus('testing')
    setCameraError('')
    try {
      // POST to /camera/connect which does a real TCP probe
      const res = await api.post('/camera/connect', { ip: config.camera_ip })
      if (res.data.connected) {
        setCameraStatus('connected')
      } else {
        setCameraStatus('failed')
        setCameraError(res.data.message || 'Connection failed')
      }
    } catch {
      setCameraStatus('failed')
      setCameraError(`Cannot reach backend`)
    }
  }

  const clearAllData = async () => {
    try {
      await api.delete('/data/clear')
      toast('All data cleared', 'success')
    } catch {
      toast('Clear failed', 'error')
    }
    setClearConfirm(false)
    setClearConfirm2(false)
  }

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      {/* Tab Sidebar */}
      <div className="card card--info flex-shrink-0 py-3" style={{ width: 220 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSettingsTab(id)}
            className={`sidebar-link w-full text-left ${activeSettingsTab === id ? 'active' : ''}`}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card card--neutral flex-1 overflow-y-auto p-6" style={{ borderLeftColor: 'transparent' }}>
        {activeSettingsTab === 'standards' && (
          <StandardsTab config={config} field={field} save={save} saving={saving} savedFields={savedFields} />
        )}
        {activeSettingsTab === 'camera' && (
          <CameraTab
            config={config} field={field} save={save} saving={saving}
            testCamera={testCamera} cameraStatus={cameraStatus} cameraError={cameraError}
          />
        )}
        {activeSettingsTab === 'roll' && (
          <RollTab config={config} field={field} save={save} saving={saving} setConfig={setConfig} />
        )}
        {activeSettingsTab === 'system' && (
          <SystemTab config={config} field={field} save={save} saving={saving}
            theme={theme} toggleTheme={toggleTheme}
            onClearRequest={() => setClearConfirm(true)} />
        )}
        {activeSettingsTab === 'users' && authUser?.role === 'admin' && (
          <UserManagementTab />
        )}
      </div>

      {clearConfirm && !clearConfirm2 && (
        <div className="modal-overlay">
          <div className="modal-panel w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-500" />
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Clear All Data?</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will permanently delete all rolls, defects, and analytics data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button className="btn btn-amber flex-1 justify-center" onClick={() => setClearConfirm2(true)}>Continue</button>
            </div>
          </div>
        </div>
      )}
      {clearConfirm2 && (
        <div className="modal-overlay">
          <div className="modal-panel w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={20} style={{ color: 'var(--accent-danger)' }} />
              <h3 className="font-bold text-base" style={{ color: 'var(--accent-danger)' }}>Final Confirmation</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you <strong>absolutely sure</strong>? All data will be permanently destroyed.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => { setClearConfirm(false); setClearConfirm2(false) }}>Cancel</button>
              <button className="btn btn-danger flex-1 justify-center" onClick={clearAllData}>Yes, Delete Everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Standards Tab ─────────────────────────────────────────────────────────────
function StandardsTab({ config, field, save, saving, savedFields }) {
  const PENALTY_RULES = [
    { key: 'penalty_1pt', label: '≤ X inches', desc: '1 pt', pillColor: '#94A3B8' },
    { key: 'penalty_2pt', label: '> 1pt and ≤ X inches', desc: '2 pts', pillColor: '#3B82F6' },
    { key: 'penalty_3pt', label: '> 2pt and ≤ X inches', desc: '3 pts', pillColor: '#F59E0B' },
  ]

  return (
    <div className="max-w-2xl flex flex-col h-full space-y-6">
      <SectionHeader title="Inspection Standards" sub="Configure 4-point grading rules and acceptance thresholds" />

      <div className="grid grid-cols-2 gap-6">
        <FormRow label="Acceptance Threshold" sub="Points per 100 square yards" saved={savedFields['acceptance_threshold']}>
          <input type="number" min={1} max={100} className="input font-mono" style={{ width: 120 }} {...field('acceptance_threshold')} />
        </FormRow>
        <FormRow label="Fabric Width" sub="Width in meters (positive value)" saved={savedFields['fabric_width_m']}>
          <div className="flex items-center gap-2">
            <input type="number" min={0.1} step={0.01} className="input font-mono" style={{ width: 120 }} {...field('fabric_width_m')} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>m</span>
          </div>
        </FormRow>
      </div>

      <FormRow label="Min Defect Area" sub="Minimum contour area to detect (pixels²)" saved={savedFields['min_defect_area_px']}>
        <div className="flex items-center gap-2">
          <input type="number" min={1} className="input font-mono" style={{ width: 120 }} {...field('min_defect_area_px')} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>px²</span>
        </div>
      </FormRow>

      <div className="flex-1">
        <h4 className="section-label mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>4-Point Penalty Table</h4>
        <div className="card card--neutral overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Defect Length (inches)</th>
                <th>Threshold (in)</th>
                <th>Penalty</th>
              </tr>
            </thead>
            <tbody>
              {PENALTY_RULES.map(rule => (
                <tr key={rule.key}>
                  <td className="text-sm font-medium">{rule.label}</td>
                  <td>
                    <input type="number" min={1} className="input font-mono" style={{ width: 80, padding: '4px 8px' }} {...field(rule.key)} />
                  </td>
                  <td><span className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{ background: rule.pillColor }}>{rule.desc}</span></td>
                </tr>
              ))}
              <tr>
                <td className="text-sm font-medium">≥ 9 inches or full width</td>
                <td><span className="data-value text-sm" style={{ color: 'var(--text-muted)' }}>Always</span></td>
                <td><span className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{ background: '#EF4444' }}>4 pts</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <SaveButton saving={saving} onClick={() => save()} />
    </div>
  )
}

// ── Camera Tab ────────────────────────────────────────────────────────────────
function CameraTab({ config, field, save, saving, testCamera, cameraStatus, cameraError }) {
  return (
    <div className="max-w-2xl flex flex-col h-full space-y-6">
      <SectionHeader title="Camera Settings" sub="Configure GigE Vision line-scan camera connection" />

      <div className="grid grid-cols-2 gap-6">
        <FormRow label="Camera Mode" sub="GigE camera or demo mode">
          <div className="flex gap-4 mt-1">
            {['demo', 'gigE'].map(m => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="camera_mode"
                  value={m}
                  checked={config.camera_mode === m}
                  onChange={e => field('camera_mode').onChange(e)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {m === 'demo' ? 'Simulation' : 'GigE Camera'}
                </span>
              </label>
            ))}
          </div>
        </FormRow>

        <FormRow label="Camera IP Address" sub="IPv4 address of GigE camera">
          <input type="text" className="input font-mono" style={{ width: '100%' }} placeholder="192.168.1.100" {...field('camera_ip')} />
        </FormRow>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <FormRow label="Exposure Time" sub="Microseconds (μs)">
          <div className="flex items-center gap-2">
            <input type="number" min={100} className="input font-mono" style={{ width: 120 }} {...field('exposure_time')} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>μs</span>
          </div>
        </FormRow>
        <FormRow label="Line Rate" sub="Lines per second">
          <div className="flex items-center gap-2">
            <input type="number" min={1000} className="input font-mono" style={{ width: 120 }} {...field('line_rate')} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>fps</span>
          </div>
        </FormRow>
      </div>

      {/* Connection Status */}
      <div className="flex-1 mt-6">
        <h4 className="section-label mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>Connection Status</h4>
        <div className="card card--neutral p-5">
          {/* Status result */}
          {cameraStatus === 'connected' && (
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--accent-success)' }}>
              <span className="w-3 h-3 rounded-full bg-green-500" style={{ boxShadow: '0 0 8px #22c55e' }} />
              <span className="font-bold text-sm">✓ Connected · MV-GEL83BM · GigE port open</span>
            </div>
          )}
          {cameraStatus === 'failed' && (
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--accent-danger)' }}>
              <span className="w-3 h-3 rounded-full bg-red-500" style={{ boxShadow: '0 0 8px #ef4444' }} />
              <span className="font-bold text-sm">✕ {cameraError || 'Connection failed'} — Check cable and IP settings</span>
            </div>
          )}
          {cameraStatus === 'testing' && (
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
              <span className="font-semibold text-sm">⟳ Testing connection to {config.camera_ip}…</span>
            </div>
          )}
          {cameraStatus === null && (
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="font-semibold text-sm">Unknown Status</span>
            </div>
          )}

          <p className="data-value text-sm mb-4">IP: {config.camera_ip || '192.168.1.100'}</p>
          <button
            className="btn btn-ghost text-xs"
            onClick={testCamera}
            disabled={cameraStatus === 'testing'}
            title={cameraStatus === 'testing' ? 'Test in progress…' : 'Test TCP connection to camera'}
            style={cameraStatus === 'testing' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {cameraStatus === 'testing' ? (
              <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-1" />
            ) : <Wifi size={14} className="mr-1" />}
            Test Connection
          </button>

          {cameraStatus === 'connected' && (
            <div className="mt-4 pt-4 border-t border-dashed" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>✓ MindVision MV-GEL83BM · 4096×1px</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Exposure: {config.exposure_time}µs</p>
            </div>
          )}
        </div>
      </div>

      <SaveButton saving={saving} onClick={() => save()} />
    </div>
  )
}

// ── Roll Tab ──────────────────────────────────────────────────────────────────
function RollTab({ config, field, save, saving, setConfig }) {
  return (
    <div className="max-w-2xl flex flex-col h-full space-y-6">
      <SectionHeader title="Roll Management" sub="Configure roll naming, auto-finish, and alert settings" />

      <FormRow label="Roll ID Prefix" sub="Prefix for auto-generated Roll IDs">
        <input type="text" className="input font-mono" style={{ width: 140 }} maxLength={10} {...field('roll_prefix')} />
      </FormRow>

      <FormRow label="Auto-Finish Roll" sub="Automatically finish roll when fabric length reached">
        <div className="flex items-center gap-3 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.auto_finish_enabled === 'true'}
              onChange={e => setConfig(c => ({ ...c, auto_finish_enabled: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Enable Auto-Finish</span>
          </label>
          {config.auto_finish_enabled === 'true' && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>after</span>
              <input type="number" min={1} className="input font-mono" style={{ width: 100 }} {...field('auto_finish_meters')} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>meters</span>
            </div>
          )}
        </div>
      </FormRow>

      <FormRow label="Warning Threshold" sub="Alert when this % of penalty limit is reached">
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={100} className="input font-mono" style={{ width: 100 }} {...field('warn_threshold_pct')} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
        </div>
      </FormRow>

      <div className="flex-1" />
      <SaveButton saving={saving} onClick={() => save()} />
    </div>
  )
}

// ── System Tab ────────────────────────────────────────────────────────────────
function SystemTab({ config, field, save, saving, theme, toggleTheme, onClearRequest }) {
  return (
    <div className="max-w-2xl flex flex-col h-full space-y-6">
      <SectionHeader title="User & System" sub="Factory info, operator, data storage, and appearance" />

      <div className="grid grid-cols-2 gap-6">
        <FormRow label="Factory Name" sub="Shown in all exported reports">
          <input type="text" className="input" {...field('factory_name')} />
        </FormRow>
        <FormRow label="Operator Name" sub="Saved with each roll record">
          <input type="text" className="input" {...field('operator_name')} />
        </FormRow>
      </div>

      <FormRow label="Data Storage Path" sub="Where local SQLite DB and recordings are saved">
        <div className="flex gap-2 w-full mt-1">
          <input type="text" className="input font-mono flex-1 text-sm" {...field('data_path')} />
          <button
            className="btn btn-ghost flex-shrink-0"
            onClick={async () => {
              if (window.electronAPI) {
                const dir = await window.electronAPI.openDirectory()
                if (dir) field('data_path').onChange({ target: { value: dir } })
              }
            }}
          >
            Browse
          </button>
        </div>
      </FormRow>

      <FormRow label="Theme Mode" sub="Interface appearance">
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="theme" checked={theme === 'light'} onChange={() => theme === 'dark' && toggleTheme()} className="w-4 h-4 text-blue-600 border-gray-300" />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Light</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => theme === 'light' && toggleTheme()} className="w-4 h-4 text-blue-600 border-gray-300" />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Dark</span>
          </label>
        </div>
      </FormRow>

      <div className="flex-1" />

      <div className="flex flex-col gap-3">
        <button className="btn btn-danger w-full justify-center py-2.5 text-sm" onClick={onClearRequest}>
          <Trash2 size={16} /> Factory Reset (Clear All Data)
        </button>
        <SaveButton saving={saving} onClick={() => save()} />
      </div>
    </div>
  )
}

// ── User Management Tab ───────────────────────────────────────────────────────
const ROLE_BADGES = {
  admin:    { color: '#F87171', bg: 'rgba(239,68,68,0.12)',  dot: '#EF4444' },
  operator: { color: '#60A5FA', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
  viewer:   { color: '#34D399', bg: 'rgba(16,185,129,0.12)', dot: '#10B981' },
}

function RoleBadge({ role }) {
  const c = ROLE_BADGES[role] || ROLE_BADGES.viewer
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
      {role}
    </span>
  )
}

function UserModal({ mode, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { username: '', full_name: '', email: '', role: 'operator', password: '', force_password_change: true })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return }
    if (mode === 'add' && !form.username.trim()) { setError('Username is required'); return }
    if (mode === 'add' && !form.password) { setError('Password is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            {mode === 'add' ? 'Add New User' : 'Edit User'}
          </h3>
          <button onClick={onClose} className="btn btn-ghost p-1 border-0"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <FormRow label="Full Name" sub="Display name">
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Ali Khan" />
          </FormRow>

          {mode === 'add' && (
            <FormRow label="Username" sub="Lowercase, alphanumeric + underscore">
              <input className="input font-mono" value={form.username}
                onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. operator_1" />
            </FormRow>
          )}

          <FormRow label="Email" sub="Optional">
            <input className="input" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="user@company.com" type="email" />
          </FormRow>

          <FormRow label="Role" sub="Determines access level">
            <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </FormRow>

          <FormRow label={mode === 'add' ? 'Password' : 'New Password (leave blank to keep)'} sub="Min 8 chars, uppercase, number, special">
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="input" style={{ paddingRight: 40 }}
                value={form.password || ''} onChange={e => set('password', e.target.value)}
                placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'Temporary password'}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </FormRow>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.force_password_change}
              onChange={e => set('force_password_change', e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#3B82F6' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Force password change on first login</span>
          </label>

          {error && (
            <div style={{ color: '#FCA5A5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1 justify-center" onClick={handleSave}>
            {mode === 'add' ? 'Create User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UserManagementTab() {
  const { user: authUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null) // null | { mode, initial }
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      setUsers(res.data.users || [])
    } catch {
      toast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSave = async (form) => {
    try {
      if (modal.mode === 'add') {
        await api.post('/users', form)
        toast(`User @${form.username} created`, 'success')
      } else {
        const body = { role: form.role, full_name: form.full_name, email: form.email, force_password_change: form.force_password_change ? 1 : 0 }
        if (form.password) body.new_password = form.password
        await api.put(`/users/${modal.initial.id}`, body)
        toast('User updated', 'success')
      }
      setModal(null)
      fetchUsers()
    } catch (err) {
      toast(err.response?.data?.detail || 'Operation failed', 'error')
    }
  }

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 })
      toast(`${u.username} ${u.is_active ? 'deactivated' : 'activated'}`, 'info')
      fetchUsers()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed', 'error')
    }
  }

  const handleDelete = async (u) => {
    try {
      await api.delete(`/users/${u.id}`)
      toast(`@${u.username} deleted`, 'success')
      setDeleteConfirm(null)
      fetchUsers()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed', 'error')
    }
  }

  const formatDate = (d) => {
    if (!d) return 'Never'
    const diff = (Date.now() - new Date(d)) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return new Date(d).toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full" style={{ gap: 16 }}>
      <SectionHeader title="User Management" sub="Manage system users, roles, and access levels (Admin only)" />

      <div className="flex justify-end">
        <button
          onClick={() => setModal({ mode: 'add', initial: null })}
          className="btn btn-primary text-xs py-2 px-4"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={13} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden flex-1" style={{ overflowY: 'auto' }}>
        <table className="data-table" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
            {!loading && users.map(u => (
              <tr key={u.id}>
                <td>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>@{u.username}</span>
                  {u.id === authUser?.id && <span style={{ fontSize: 9, color: '#60A5FA', marginLeft: 6 }}>YOU</span>}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.full_name}</td>
                <td><RoleBadge role={u.role} /></td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                    color: u.is_active ? '#34D399' : '#94A3B8',
                  }}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(u.last_login)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setModal({ mode: 'edit', initial: u })}
                      className="btn btn-ghost text-xs py-1 px-2"
                      title="Edit user"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === authUser?.id}
                      className="btn btn-ghost text-xs py-1 px-2"
                      title={u.is_active ? 'Deactivate' : 'Activate'}
                      style={u.id === authUser?.id ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                    >
                      {u.is_active ? <ToggleRight size={13} style={{ color: '#10B981' }} /> : <ToggleLeft size={13} style={{ color: '#94A3B8' }} />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(u)}
                      disabled={u.id === authUser?.id}
                      className="btn btn-ghost text-xs py-1 px-2"
                      title={u.id === authUser?.id ? 'Cannot delete own account' : 'Delete user'}
                      style={u.id === authUser?.id ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                    >
                      <Trash size={11} style={{ color: '#F87171' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          mode={modal.mode}
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-panel w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash size={18} style={{ color: '#EF4444' }} />
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Delete User?</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Delete <strong>@{deleteConfirm.username}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger flex-1 justify-center" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ borderBottom: '1.5px solid var(--border-default)', paddingBottom: 16, marginBottom: 8 }}>
      <h2 className="page-title">{title}</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  )
}

function FormRow({ label, sub, children, saved }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</label>
        {saved && (
          <span style={{ color: 'var(--accent-success)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <CheckCircle size={12} /> Saved
          </span>
        )}
      </div>
      {sub && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      <div className="w-full">{children}</div>
    </div>
  )
}

function SaveButton({ saving, onClick }) {
  return (
    <button
      className="btn btn-primary w-full justify-center py-2.5 text-sm"
      onClick={onClick}
      disabled={saving}
      style={saving ? { opacity: 0.7 } : {}}
    >
      {saving ? (
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
      ) : <Save size={16} />}
      {saving ? 'Saving…' : 'Save Settings'}
    </button>
  )
}

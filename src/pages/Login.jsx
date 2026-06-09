import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'

const C = {
  primary: '#264C59',
  accent:  '#F7A536',
  border:  '#C8DDE5',
  borderLt:'#E4EEF1',
  text:    '#0F1A1F',
  body:    '#4A6572',
  muted:   '#7A9AA8',
  success: '#10B981',
  danger:  '#EF4444',
  surface: '#F8FAFB',
  trust:   '#EAF2F5',
}

// Animated count-up
function useCountUp(target, duration = 1800, active = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let current = 0
    const step = target / (duration / 16)
    const t = setInterval(() => {
      current += step
      if (current >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(current))
    }, 16)
    return () => clearInterval(t)
  }, [target, duration, active])
  return val
}

function StatPill({ value, suffix = '', label, delay = 0, color = C.primary }) {
  const [active, setActive] = useState(false)
  useEffect(() => { const t = setTimeout(() => setActive(true), delay); return () => clearTimeout(t) }, [delay])
  const count = useCountUp(value, 1800, active)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: '#fff', borderRadius: 10,
      padding: '12px 20px',
      borderTop: `3px solid ${color}`,
      border: `1.5px solid ${C.border}`,
      borderTopColor: color,
      boxShadow: '0 2px 8px rgba(38,76,89,0.06)',
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", minWidth: 64 }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: 14, color: C.muted, fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

export default function Login({ onLogin, onBack }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) { setError('Please enter your username and password'); return }
    setError('')
    setLoading(true)
    try {
      const user = await login(username.trim().toLowerCase(), password)
      onLogin(user)
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: C.surface, overflow: 'hidden' }}>

      {/* ── Left branding panel ── */}
      <div style={{
        width: '52%', flexShrink: 0,
        background: `linear-gradient(160deg, #1A3A45 0%, ${C.primary} 55%, #1A3A45 100%)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '56px 48px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(255,255,255,0.03) 28px,rgba(255,255,255,0.03) 29px),
                            repeating-linear-gradient(90deg,transparent,transparent 28px,rgba(255,255,255,0.03) 28px,rgba(255,255,255,0.03) 29px)`,
        }} />

        {/* Scan line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          boxShadow: `0 0 14px ${C.accent}, 0 0 28px rgba(247,165,54,0.3)`,
          animation: 'loginScan 5s linear infinite', pointerEvents: 'none',
        }} />

        {/* Corner accent */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 120, height: 120,
          background: `radial-gradient(circle at top right, rgba(247,165,54,0.12), transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 160, height: 160,
          background: `radial-gradient(circle at bottom left, rgba(16,185,129,0.08), transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 360, width: '100%' }}>
          {/* Logo mark */}
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: 'rgba(255,255,255,0.08)',
            border: '2px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px' }}>
              <span style={{ color: '#fff' }}>M</span>
              <span style={{ color: C.accent }}>Q</span>
            </span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            <span style={{ color: '#fff' }}>Magic</span><span style={{ color: C.accent }}>QC</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.5, fontWeight: 500 }}>
            Industry 4.0 Fabric Quality Inspection
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)', marginBottom: 32 }} />

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatPill value={847}  label="Rolls Inspected"     delay={200}  color={C.accent} />
            <StatPill value={94}   suffix=".2%" label="Pass Rate" delay={500} color={C.success} />
            <StatPill value={12}   label="Defect Types Tracked" delay={800}  color={C.primary} />
          </div>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 40 }}>
            v1.0.0 · Powered by MindVision GigE
          </p>
        </div>
      </div>

      {/* ── Right sign-in panel ── */}
      <div style={{
        flex: 1,
        background: '#fff',
        borderLeft: `2px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Back link */}
          {onBack && (
            <button type="button" onClick={onBack} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 28, padding: 0, transition: 'color 0.15s',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.primary}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              ← Back to Home
            </button>
          )}

          {/* Heading */}
          <h2 style={{ fontSize: 32, fontWeight: 800, color: C.text, margin: '0 0 8px', letterSpacing: '-0.4px' }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: 16, color: C.body, margin: '0 0 32px', lineHeight: 1.6 }}>
            Sign in to your MagicQC workspace
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
                style={{
                  width: '100%', height: 50, boxSizing: 'border-box',
                  border: `2px solid ${error ? C.danger : C.border}`,
                  borderRadius: 8, padding: '0 16px',
                  fontSize: 15, color: C.text, background: '#FAFCFD',
                  outline: 'none', fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(38,76,89,0.09)' }}
                onBlur={e => { e.target.style.borderColor = error ? C.danger : C.border; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    width: '100%', height: 50, boxSizing: 'border-box',
                    border: `2px solid ${error ? C.danger : C.border}`,
                    borderRadius: 8, padding: '0 48px 0 16px',
                    fontSize: 15, color: C.text, background: '#FAFCFD',
                    outline: 'none', fontFamily: 'Inter, sans-serif',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(38,76,89,0.09)' }}
                  onBlur={e => { e.target.style.borderColor = error ? C.danger : C.border; e.target.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2,
                }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#FEF2F2', border: `1.5px solid ${C.danger}`,
                borderRadius: 8, padding: '10px 14px',
                color: C.danger, fontSize: 14, lineHeight: 1.5,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              height: 54, borderRadius: 8, border: 'none',
              background: loading ? C.muted : C.primary,
              color: '#fff', fontSize: 17, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
              marginTop: 4,
              boxShadow: loading ? 'none' : '0 4px 14px rgba(38,76,89,0.25)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1A3A45' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.primary }}>
              {loading ? (
                <><span style={{ width: 17, height: 17, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'loginSpin 0.7s linear infinite', display: 'inline-block' }} /> Signing in…</>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Access notice */}
          <div style={{
            marginTop: 28, padding: '14px 16px',
            background: C.trust, border: `1.5px solid ${C.border}`,
            borderLeft: `4px solid ${C.accent}`,
            borderRadius: 8,
          }}>
            <p style={{ fontSize: 14, color: C.primary, fontWeight: 600, margin: '0 0 4px' }}>
              🔒 Restricted Access
            </p>
            <p style={{ fontSize: 14, color: C.body, margin: 0, lineHeight: 1.55 }}>
              Access requires admin approval. Contact your system administrator to request an account.
            </p>
          </div>

          <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', margin: '24px 0 0', lineHeight: 1.6 }}>
            © 2024 MagicQC · Need help? Contact your administrator
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loginScan {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

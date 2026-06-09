import React, { useState, useEffect, useRef } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:  '#264C59',
  accent:   '#F7A536',
  bg:       '#FFFFFF',
  surface:  '#F8FAFB',
  trust:    '#EAF2F5',
  border:   '#C8DDE5',
  borderLt: '#E4EEF1',
  text:     '#0F1A1F',
  body:     '#4A6572',
  muted:    '#7A9AA8',
  success:  '#10B981',
  danger:   '#EF4444',
  dark:     '#0F1A1F',
}

const TITLE_H = 36   // px — fixed TitleBar height
const NAV_H   = 58   // px — sticky nav height

// ── Shared primitives ─────────────────────────────────────────────────────────
const Logo = ({ size = 20, whiteText = false }) => (
  <span style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1 }}>
    <span style={{ color: whiteText ? '#fff' : C.primary }}>Magic</span>
    <span style={{ color: C.accent }}>QC</span>
  </span>
)

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 13, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '1.3px', margin: '0 0 12px' }}>
    {children}
  </p>
)

const SectionTitle = ({ children, style }) => (
  <h2 style={{ fontSize: 38, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.15, margin: '0 0 16px', ...style }}>
    {children}
  </h2>
)

const SectionDesc = ({ children, style }) => (
  <p style={{ fontSize: 16, color: C.body, lineHeight: 1.75, margin: '0 0 44px', ...style }}>
    {children}
  </p>
)

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onSignInClick, scrollEl }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scrollEl?.current
    if (!el) return
    const h = () => setScrolled(el.scrollTop > 20)
    el.addEventListener('scroll', h, { passive: true })
    return () => el.removeEventListener('scroll', h)
  }, [scrollEl])

  const go = (id) => {
    const target = document.getElementById(id)
    if (!target || !scrollEl?.current) return
    scrollEl.current.scrollTo({ top: target.offsetTop - NAV_H, behavior: 'smooth' })
  }

  return (
    <nav style={{
      height: NAV_H, background: C.bg,
      borderBottom: `2px solid ${C.borderLt}`,
      display: 'flex', alignItems: 'center', padding: '0 48px',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: scrolled ? '0 2px 12px rgba(38,76,89,0.10)' : 'none',
      transition: 'box-shadow 0.2s', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={24} />
      </div>

      {/* Links */}
      <div style={{ display: 'flex', gap: 32 }}>
        {[['Features','features'],['How It Works','how'],['Standards','standards'],['Pricing','pricing']].map(([lbl, id]) => (
          <NavLink key={id} onClick={() => go(id)}>{lbl}</NavLink>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onSignInClick} style={{
          height: 42, padding: '0 22px', borderRadius: 7,
          border: `2px solid ${C.primary}`, background: 'transparent',
          color: C.primary, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.primary }}>
          Sign In
        </button>
        <button onClick={() => go('pricing')} style={{
          height: 42, padding: '0 22px', borderRadius: 7,
          background: C.primary, border: 'none',
          color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#1A3A45'}
        onMouseLeave={e => e.currentTarget.style.background = C.primary}>
          View Pricing
        </button>
      </div>
    </nav>
  )
}

function NavLink({ onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
        fontSize: 15, fontWeight: 600, color: hov ? C.primary : C.body,
        fontFamily: 'Inter, sans-serif',
        borderBottom: hov ? `2px solid ${C.accent}` : '2px solid transparent',
        transition: 'color 0.15s, border-color 0.15s',
      }}>
      {children}
    </button>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ scrollEl }) {
  const go = (id) => {
    const target = document.getElementById(id)
    if (!target || !scrollEl?.current) return
    scrollEl.current.scrollTo({ top: target.offsetTop - NAV_H, behavior: 'smooth' })
  }

  return (
    <section style={{ background: C.bg, padding: '72px 48px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 64 }}>

        {/* Left */}
        <div style={{ flex: '0 0 50%', animation: 'lndFadeUp 0.6s ease forwards' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#FEF3E2', border: `2px solid ${C.accent}`,
            borderRadius: 20, padding: '6px 16px', marginBottom: 22,
            fontSize: 14, color: '#B8741A', fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, background: C.accent, borderRadius: '50%', display: 'inline-block', animation: 'lndPulse 2s infinite' }} />
            Industry 4.0 Fabric Intelligence
          </div>

          <h1 style={{ fontSize: 54, fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: '-1.5px', margin: '0 0 22px' }}>
            Catch Every Defect.<br />
            Before It <span style={{ color: C.accent }}>Costs</span>{' '}
            <span style={{ color: C.primary }}>You.</span>
          </h1>

          <p style={{ fontSize: 17, color: C.body, lineHeight: 1.75, maxWidth: 500, margin: '0 0 30px', fontWeight: 400 }}>
            MagicQC is the real-time fabric defect detection system built on the 4-Point Industrial Standard — powered by line-scan camera technology and intelligent shift analytics.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button onClick={() => go('pricing')} style={{
              background: C.accent, border: 'none', borderRadius: 8,
              color: '#fff', padding: '15px 32px', fontSize: 17, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 14px rgba(247,165,54,0.35)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E09420'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(247,165,54,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = '0 4px 14px rgba(247,165,54,0.35)' }}>
              View Pricing →
            </button>
            <button onClick={() => go('how')} style={{
              border: `2px solid ${C.primary}`, background: 'transparent',
              borderRadius: 8, color: C.primary, padding: '15px 32px',
              fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.primary }}>
              See How It Works
            </button>
          </div>

          {/* Trust strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: C.muted, fontWeight: 500, flexWrap: 'wrap' }}>
            {['Admin-controlled access', 'Works offline', '4-Point Standard compliant', 'Windows desktop app'].map((t, i, arr) => (
              <React.Fragment key={t}>
                <span>{t}</span>
                {i < arr.length - 1 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4E4EA', display: 'inline-block' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right — mockup */}
        <div style={{ flex: '0 0 50%', animation: 'lndFadeUp 0.6s ease 0.15s forwards', opacity: 0 }}>
          <div style={{
            background: '#F0F6F8', border: `2px solid ${C.border}`,
            borderRadius: 16, padding: 20,
            boxShadow: '0 12px 48px rgba(38,76,89,0.13)',
          }}>
            {/* Traffic lights */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 8, fontWeight: 500 }}>MagicQC · Live Inspection</span>
            </div>

            {/* Fabric strip */}
            <div style={{ background: C.primary, borderRadius: 10, height: 110, position: 'relative', overflow: 'hidden', marginBottom: 14 }}>
              {/* Scan line */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: 3,
                background: 'linear-gradient(180deg, transparent, #F7A536, transparent)',
                animation: 'lndScan 2.2s linear infinite',
                boxShadow: '0 0 10px rgba(247,165,54,0.6)',
              }} />
              {/* Defect pins */}
              {[{left:'22%',top:28},{left:'54%',top:54},{left:'75%',top:18}].map((p, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 16, height: 16, background: C.accent,
                  borderRadius: '50%', border: '2.5px solid #fff',
                  left: p.left, top: p.top,
                  boxShadow: '0 0 12px rgba(247,165,54,0.8)',
                }} />
              ))}
              {/* LIVE badge */}
              <div style={{
                position: 'absolute', left: 9, top: 8,
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: 10, padding: '2px 8px', fontSize: 9, color: C.success, fontWeight: 700,
              }}>● LIVE</div>
              {/* Fabric label */}
              <div style={{ position: 'absolute', right: 9, top: 8, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>1.37m Grey Fabric</div>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { val: '24',  label: 'Rolls Today',  color: C.primary },
                { val: '3',   label: 'Defects Found', color: C.accent },
                { val: '92%', label: 'Pass Rate',     color: C.success },
              ].map(s => (
                <div key={s.label} style={{
                  background: '#fff', border: `2px solid #D4E4EA`,
                  borderTop: `4px solid ${s.color}`, borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

// ── Trust bar ─────────────────────────────────────────────────────────────────
function TrustBar() {
  return (
    <section style={{
      background: C.trust, borderTop: `2px solid ${C.border}`, borderBottom: `2px solid ${C.border}`,
      padding: '22px 48px',
    }}>
      <p style={{ textAlign: 'center', fontSize: 13, color: C.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 0 16px' }}>
        Built for quality-conscious manufacturers
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        {['Textile Mills','Garment Factories','Export Houses','QC Departments','Fabric Suppliers'].map(n => (
          <div key={n} style={{
            background: '#fff', border: `2px solid ${C.border}`, borderLeft: `4px solid ${C.primary}`,
            borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, color: C.primary,
          }}>
            {n}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
const LEFT_BORDERS = [C.primary, C.accent, C.success, C.primary, C.accent, C.success]
const FEATURES = [
  { emoji: '📷', title: 'Real-Time Detection',       desc: 'Line-scan camera captures every millimeter. Defects pinned live as they pass through the inspection zone.', bg: '#EAF2F5', color: C.primary },
  { emoji: '📊', title: '4-Point Standard Grading',  desc: 'Automatic penalty scoring per the 4-Point System. Rolls graded PASSED or FAILED with a full audit trail.',  bg: '#FEF3E2', color: C.accent },
  { emoji: '👥', title: 'Multi-User Roles',           desc: 'Admin, Operator, and Viewer access levels. Every action is logged — full accountability across every shift.', bg: '#E6F7EF', color: C.success },
  { emoji: '📈', title: 'Industry 4.0 Analytics',    desc: 'Defect heatmaps, OEE quality gauge, shift filtering — a real control room dashboard for QC managers.',        bg: '#EAF2F5', color: C.primary },
  { emoji: '🔒', title: '100% On-Premise',            desc: 'Runs entirely on your factory PC. No cloud, no internet required. Your production data never leaves the building.', bg: '#FEF3E2', color: C.accent },
  { emoji: '📄', title: 'Instant Reports',            desc: 'One-click CSV export per roll or per shift. Share with buyers and auditors in seconds, not hours.',            bg: '#E6F7EF', color: C.success },
]

function Features() {
  return (
    <section id="features" style={{ background: C.bg, padding: '80px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionLabel>Capabilities</SectionLabel>
        <SectionTitle>Everything your QC team needs</SectionTitle>
        <SectionDesc style={{ maxWidth: 540 }}>
          From live defect detection to shift-level analytics — every tool your quality team needs, built into one system.
        </SectionDesc>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} {...f} leftBorder={LEFT_BORDERS[i]} />)}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ emoji, title, desc, bg, color, leftBorder }) {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background: '#fff',
      borderRadius: 12,
      padding: 28,
      outline: `2px solid ${hov ? leftBorder : C.border}`,
      outlineOffset: '-2px',
      boxShadow: `inset 5px 0 0 0 ${leftBorder}, ${hov ? '0 8px 28px rgba(38,76,89,0.12)' : '0 2px 8px rgba(38,76,89,0.04)'}`,
      transform: hov ? 'translateY(-3px)' : 'none',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12, background: bg,
        border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 24, marginBottom: 18,
      }}>
        {emoji}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 15, color: C.body, lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

// ── How It Works ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, color: C.primary, title: 'Connect Camera',  desc: 'Plug in your MindVision GigE line-scan camera via RJ45. The system auto-detects it on launch.' },
  { num: 2, color: C.accent,  title: 'Start Inspection', desc: 'Operator clicks Start Roll. Fabric passes through. Every defect pinned on screen in real time.' },
  { num: 3, color: C.primary, title: 'Auto Grading',     desc: '4-Point penalty score calculated live. Roll auto-graded PASSED or FAILED when finished.' },
  { num: 4, color: C.accent,  title: 'Export & Decide',  desc: 'Download the CSV report, review shift analytics, and act with full data confidence.' },
]

function HowItWorks() {
  return (
    <section id="how" style={{
      background: C.surface, borderTop: `2px solid ${C.borderLt}`, borderBottom: `2px solid ${C.borderLt}`,
      padding: '80px 48px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionLabel>Process</SectionLabel>
        <SectionTitle>Up and running in minutes</SectionTitle>
        <SectionDesc>Four simple steps from camera connection to actionable quality data.</SectionDesc>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {/* Dashed connector */}
          <div style={{
            position: 'absolute', top: 27, left: '12.5%', right: '12.5%', height: 2, zIndex: 0,
            background: 'repeating-linear-gradient(90deg,#C8DDE5 0,#C8DDE5 10px,transparent 10px,transparent 20px)',
          }} />
          {STEPS.map(s => (
            <div key={s.num} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: s.color,
                color: '#fff', fontSize: 20, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px', border: '4px solid #F8FAFB',
                boxShadow: `0 0 0 2.5px ${s.color}`,
              }}>
                {s.num}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 15, color: C.body, lineHeight: 1.6, padding: '0 12px' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Standards ─────────────────────────────────────────────────────────────────
const PT_COLORS = { 1: C.muted, 2: C.primary, 3: C.accent, 4: C.danger }
const PENALTIES = [
  { pt: 1, desc: '3 inches or less' },
  { pt: 2, desc: 'Over 3 but not over 6 inches' },
  { pt: 3, desc: 'Over 6 but not over 9 inches / half width' },
  { pt: 4, desc: 'Over 9 inches / full width — always maximum penalty' },
  { pt: 4, desc: 'Continuous running defect > 9 inches per yard' },
  { pt: 4, desc: 'Splice or full-width defect' },
]

function Standards() {
  return (
    <section id="standards" style={{ background: C.bg, padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>Grading System</SectionLabel>
        <SectionTitle>Industry-standard grading, built in</SectionTitle>
        <SectionDesc>
          The internationally recognised 4-Point System assigns penalty points based on defect length. MagicQC automates every calculation.
        </SectionDesc>

        <div style={{ border: `2px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {PENALTIES.map((p, i) => {
            const [hov, setHov] = useState(false)
            return (
              <div key={i} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
                display: 'flex', alignItems: 'center', gap: 20, padding: '17px 26px',
                background: hov ? C.surface : '#fff',
                borderBottom: i < PENALTIES.length - 1 ? `1.5px solid ${C.borderLt}` : 'none',
                transition: 'background 0.15s',
              }}>
                <div style={{
                  minWidth: 60, height: 36, borderRadius: 7,
                  background: PT_COLORS[p.pt], color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>
                  {p.pt} PT
                </div>
                <span style={{ fontSize: 16, color: C.text, fontWeight: 500 }}>{p.desc}</span>
              </div>
            )
          })}
        </div>

        <div style={{
          background: C.trust, border: `2px solid ${C.primary}`, borderLeft: `6px solid ${C.primary}`,
          borderRadius: 10, padding: '18px 26px', fontSize: 16, color: C.primary, fontWeight: 600,
          lineHeight: 1.6, marginTop: 20,
        }}>
          ✓ A roll is graded <strong>PASSED</strong> if total penalty points ≤ acceptance threshold (default: 40 pts per 100 sq yards, fully configurable).
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner({ scrollEl, onSignInClick }) {
  const go = (id) => {
    const target = document.getElementById(id)
    if (!target || !scrollEl?.current) return
    scrollEl.current.scrollTo({ top: target.offsetTop - NAV_H, behavior: 'smooth' })
  }
  return (
    <section style={{ background: C.surface, padding: '0 48px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: C.primary, borderRadius: 16, padding: '56px 56px',
          border: `2px solid #1A3A45`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 48,
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.2, margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              Ready to stop <span style={{ color: C.accent }}>guessing</span> your fabric quality?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.60)', lineHeight: 1.7, margin: 0, maxWidth: 440 }}>
              Join forward-thinking manufacturers who've moved from manual inspection to intelligent, data-driven quality control.
            </p>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <button onClick={() => go('pricing')} style={{
              background: C.accent, border: 'none', borderRadius: 8,
              color: '#fff', padding: '16px 36px', fontSize: 17, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(247,165,54,0.40)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E09420'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(247,165,54,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = '0 4px 16px rgba(247,165,54,0.40)' }}>
              See Pricing →
            </button>
            <button onClick={onSignInClick} style={{
              background: 'transparent', border: '2px solid rgba(255,255,255,0.20)',
              borderRadius: 8, color: 'rgba(255,255,255,0.65)',
              padding: '13px 28px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Sign In
            </button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Access requires admin approval</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    price: 'Contact Us',
    tagline: 'Single production line',
    color: C.primary,
    features: [
      'Real-time defect detection',
      '4-Point grading system',
      'Up to 3 user accounts',
      'Roll history & CSV export',
      'On-premise deployment',
      'Email support',
    ],
    cta: 'Request Access',
  },
  {
    name: 'Professional',
    price: 'Contact Us',
    tagline: 'Multi-line factory floor',
    color: C.accent,
    highlight: true,
    features: [
      'Everything in Starter',
      'Multi-line camera support',
      'Up to 15 user accounts',
      'Shift analytics dashboard',
      'Audit log & RBAC',
      'Priority support + onboarding',
    ],
    cta: 'Request Access',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    tagline: 'Large-scale operations',
    color: C.success,
    features: [
      'Everything in Professional',
      'Unlimited users & lines',
      'Custom defect types',
      'ERP / MES integration',
      'SLA guarantee',
      'Dedicated support engineer',
    ],
    cta: 'Talk to Sales',
  },
]

function Pricing({ onSignInClick }) {
  return (
    <section id="pricing" style={{ background: C.surface, borderTop: `2px solid ${C.borderLt}`, padding: '80px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionLabel>Pricing</SectionLabel>
          <SectionTitle style={{ margin: '0 0 14px' }}>Simple, transparent pricing</SectionTitle>
          <p style={{ fontSize: 16, color: C.body, lineHeight: 1.75, maxWidth: 480, margin: '0 auto' }}>
            All plans are deployed on-premise — your data never leaves your factory.
            Access is granted by your system administrator.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginBottom: 40 }}>
          {PLANS.map((plan) => {
            const [hov, setHov] = useState(false)
            return (
              <div
                key={plan.name}
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                  background: plan.highlight ? C.primary : '#fff',
                  border: `2px solid ${plan.highlight ? C.primary : C.border}`,
                  borderTop: `5px solid ${plan.color}`,
                  borderRadius: 16, padding: '32px 28px',
                  boxShadow: hov ? '0 12px 36px rgba(38,76,89,0.15)' : '0 2px 10px rgba(38,76,89,0.05)',
                  transform: plan.highlight ? 'scale(1.03)' : hov ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: C.accent, color: '#fff', fontSize: 12, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                    borderRadius: 20, padding: '4px 16px',
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: plan.highlight ? '#fff' : C.text, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,0.55)' : C.muted, fontWeight: 500 }}>{plan.tagline}</div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: plan.highlight ? C.accent : plan.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {plan.price}
                  </div>
                  <div style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.4)' : C.muted, marginTop: 2 }}>per factory installation</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 15, color: plan.highlight ? 'rgba(255,255,255,0.8)' : C.body, lineHeight: 1.45 }}>
                      <span style={{ color: plan.highlight ? C.accent : plan.color, flexShrink: 0, fontWeight: 800, fontSize: 16, marginTop: -1 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>

                <button onClick={onSignInClick} style={{
                  width: '100%', height: 50, borderRadius: 8, border: 'none',
                  background: plan.highlight ? C.accent : C.primary,
                  color: '#fff', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = plan.highlight ? '#E09420' : '#1A3A45'}
                onMouseLeave={e => e.currentTarget.style.background = plan.highlight ? C.accent : C.primary}>
                  {plan.cta} →
                </button>
              </div>
            )
          })}
        </div>

        {/* Access policy notice */}
        <div style={{
          maxWidth: 680, margin: '0 auto', textAlign: 'center',
          background: C.trust, border: `2px solid ${C.border}`,
          borderLeft: `5px solid ${C.accent}`, borderRadius: 12,
          padding: '20px 28px',
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.primary, margin: '0 0 6px' }}>
            🔒 Access is by administrator approval only
          </p>
          <p style={{ fontSize: 15, color: C.body, margin: 0, lineHeight: 1.6 }}>
            New user accounts are created by your system administrator after purchase.
            Contact your administrator or reach us at{' '}
            <a href="mailto:support@magicqc.com" style={{ color: C.primary, fontWeight: 600 }}>support@magicqc.com</a>{' '}
            to get started.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: C.dark, padding: '30px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div>
        <Logo size={22} whiteText />
      </div>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0 }}>© 2024 MagicQC · All rights reserved</p>
      <div style={{ display: 'flex', gap: 20 }}>
        {['Privacy','Terms','Support'].map(l => (
          <a key={l} href="#" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.85)'}
            onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>
            {l}
          </a>
        ))}
      </div>
    </footer>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Landing({ onSignInClick }) {
  const scrollRef = useRef(null)

  return (
    <>
      <style>{`
        @keyframes lndScan    { 0% { left: 0; } 100% { left: 100%; } }
        @keyframes lndPulse   { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.65); } }
        @keyframes lndFadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lndSpin    { to { transform:rotate(360deg); } }
        .lnd-scroll::-webkit-scrollbar { width: 5px; }
        .lnd-scroll::-webkit-scrollbar-track { background: transparent; }
        .lnd-scroll::-webkit-scrollbar-thumb { background: #C8DDE5; border-radius: 3px; }
        .lnd-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .lnd-root h1, .lnd-root h2, .lnd-root h3 { margin: 0; }
        .lnd-root p { margin: 0; }
        .lnd-root button { font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      <div
        ref={scrollRef}
        className="lnd-root lnd-scroll"
        style={{
          position: 'fixed', inset: 0,
          top: TITLE_H,           /* clear the fixed TitleBar */
          overflowY: 'auto', overflowX: 'hidden',
          background: C.bg,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <Nav onSignInClick={onSignInClick} scrollEl={scrollRef} />
        <Hero scrollEl={scrollRef} />
        <TrustBar />
        <Features />
        <HowItWorks />
        <Standards />
        <CTABanner scrollEl={scrollRef} onSignInClick={onSignInClick} />
        <Pricing onSignInClick={onSignInClick} />
        <Footer />
      </div>
    </>
  )
}

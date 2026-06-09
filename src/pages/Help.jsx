import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Zap, BarChart3, Download, Wrench, Info,
} from 'lucide-react'
import { useNavigation } from '../context/NavigationContext'

// Clickable deep-link that navigates to a page and optionally a settings tab
function DeepLink({ page, tab, children }) {
  const navigate = useNavigate()
  const { setActiveSettingsTab } = useNavigation()

  const handleClick = () => {
    if (tab) setActiveSettingsTab(tab)
    navigate('/' + page)
  }

  return (
    <span
      onClick={handleClick}
      style={{
        color: 'var(--accent-primary)',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      {children}
      <span style={{ fontSize: '10px', opacity: 0.7 }}>↗</span>
    </span>
  )
}

const SECTIONS = [
  {
    id: 'getting-started',
    icon: Zap,
    title: 'Getting Started',
    render: () => (
      <>
        <H2>Connecting the Camera</H2>
        <OL>
          <li>Connect the MindVision MV-GEL83BM camera to your PC via RJ45 GigE interface.</li>
          <li>Set your PC network adapter to static IP in the 192.168.1.x range.</li>
          <li>Open <DeepLink page="settings" tab="camera">Settings → Camera Settings</DeepLink> and set the Camera IP address.</li>
          <li>Click <strong>Test Connection</strong> to verify the link.</li>
          <li>If the camera is offline, the system automatically starts in <strong>Demo Mode</strong> using a simulated video feed.</li>
        </OL>
        <H2>Starting an Inspection Roll</H2>
        <OL>
          <li>Navigate to <DeepLink page="inspection">Live Inspection</DeepLink>.</li>
          <li>Confirm the video feed is visible (Demo or Live).</li>
          <li>Click <strong>Start New Roll</strong> in the right panel.</li>
          <li>A Roll ID is automatically generated (e.g., ROLL-20260508-001).</li>
          <li>The system begins counting fabric length, detecting defects, and accumulating penalty points.</li>
        </OL>
        <H2>Finishing a Roll</H2>
        <UL>
          <li>Click <strong>Finish Roll</strong> to close and save the roll to the database.</li>
          <li>Click <strong>Abort</strong> to discard the current roll data.</li>
          <li>All saved rolls appear in <DeepLink page="history">Roll History</DeepLink>.</li>
        </UL>
      </>
    ),
  },
  {
    id: '4-point',
    icon: BarChart3,
    title: 'Understanding the 4-Point Scoring System',
    render: () => (
      <>
        <H2>The 4-Point System (ASTM D5430 / Uster Standard)</H2>
        <P>The 4-point system assigns penalty points based on the length of each individual defect found in the fabric.</P>
        <SimpleTable
          headers={['Defect Length', 'Penalty Points']}
          rows={[
            ['≤ 3 inches', '1 point'],
            ['> 3 to ≤ 6 inches', '2 points'],
            ['> 6 to ≤ 9 inches', '3 points'],
            ['> 9 inches (or full width)', '4 points'],
            ['Continuous running defect > 9 in/yard', '4 points/yard'],
            ['Splice or full-width defect', '4 points'],
          ]}
        />
        <P><strong>No more than 4 points are assigned to any single defect.</strong></P>
        <H2>Calculating Points per 100 sq yards</H2>
        <P>The formula used is:</P>
        <Code>Points/100sqyd = (Total Points ÷ (Width_m × Length_m × 1.196)) × 100</Code>
        <P>Where 1.196 converts from sq meters to sq yards.</P>
        <H2>Default Acceptance Threshold</H2>
        <P>The default threshold is <strong>40 points per 100 square yards</strong>. Configurable in <DeepLink page="settings" tab="standards">Settings → Inspection Standards</DeepLink>.</P>
      </>
    ),
  },
  {
    id: 'results',
    icon: BookOpen,
    title: 'How to Read Your Results',
    render: () => (
      <>
        <H2>Roll Status Indicators</H2>
        <SimpleTable
          headers={['Status', 'Meaning']}
          rows={[
            ['INSPECTING (blue)', 'Roll is actively being inspected'],
            ['PASSED (green)', 'Final points/100sqyd is below the threshold'],
            ['FAILED (red)', 'Points exceeded the threshold — roll is rejected'],
            ['ABORTED (amber)', 'Roll was manually discarded'],
          ]}
        />
        <H2>When Does a Roll FAIL?</H2>
        <P>A roll is automatically marked FAILED the moment accumulated penalty points — when converted to points/100sqyd — exceed the configured threshold. The operator receives a critical alert modal.</P>
        <P>The operator can still continue inspecting (to document remaining defects) but the roll result cannot be changed back to PASSED.</P>
        <H2>Reviewing Results</H2>
        <P>All completed rolls are visible in <DeepLink page="history">Roll History</DeepLink>. Aggregate trends appear in <DeepLink page="analytics">Analytics</DeepLink>.</P>
      </>
    ),
  },
  {
    id: 'export',
    icon: Download,
    title: 'Exporting Reports',
    render: () => (
      <>
        <H2>CSV Export — Per Roll</H2>
        <P>From <DeepLink page="history">Roll History</DeepLink>, click the ⬇ icon on any row. You will get a CSV with:</P>
        <UL>
          <li>Roll ID, Date, Operator, Fabric Length</li>
          <li>Each defect: Type, Length (inches), Penalty Points, Position X/Y, Timestamp</li>
        </UL>
        <H2>CSV Export — Current Roll</H2>
        <P>During an active inspection, click <strong>Export CSV</strong> in the Roll Statistics panel to download the defect log for the roll currently being inspected.</P>
        <H2>Analytics Export</H2>
        <P>On the <DeepLink page="analytics">Analytics</DeepLink> page, use the <strong>Export CSV</strong> button to download a summary of KPIs and per-day roll data for the selected date range.</P>
        <H2>Video Recording</H2>
        <P>In the <DeepLink page="inspection">Live Inspection</DeepLink> feed, click <strong>⏺ Record</strong> to begin recording the video stream as MP4. Click <strong>Stop REC</strong> to end, then <strong>⬇ Download</strong> to save the file. Recordings are stored in the /recordings/ folder by default.</P>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    icon: Wrench,
    title: 'Troubleshooting',
    render: () => (
      <>
        <H2>Camera Not Detected</H2>
        <UL>
          <li>Check the RJ45 cable connection between the camera and PC.</li>
          <li>Verify your PC's NIC is set to static IP in the same subnet as the camera.</li>
          <li>Confirm the camera IP in <DeepLink page="settings" tab="camera">Settings → Camera Settings</DeepLink> matches the physical camera address.</li>
          <li>Use <strong>Test Connection</strong> to diagnose.</li>
          <li>The system will automatically enter Demo Mode if no camera is detected.</li>
        </UL>
        <H2>Demo Mode is Always Showing</H2>
        <UL>
          <li>If you just installed the system, Demo Mode is the default.</li>
          <li>To switch to a real camera: <DeepLink page="settings" tab="camera">Settings → Camera Settings</DeepLink> → Set mode to "GigE Camera" and configure the IP.</li>
        </UL>
        <H2>Backend Not Starting</H2>
        <UL>
          <li>Ensure Python 3.9+ is installed and accessible as <Code inline>python</Code> or <Code inline>python3</Code>.</li>
          <li>Verify all Python packages are installed: <Code inline>pip install -r requirements.txt</Code> in the /backend folder.</li>
          <li>Check the backend console output for error messages.</li>
        </UL>
        <H2>No Defects Detected</H2>
        <UL>
          <li>Verify the camera is capturing the fabric (not a blank or covered sensor).</li>
          <li>Increase sensitivity by lowering the <strong>Min Defect Area</strong> in <DeepLink page="settings" tab="standards">Settings → Inspection Standards</DeepLink>.</li>
          <li>The lighting should produce sufficient contrast between defects and grey fabric.</li>
        </UL>
        <H2>Roll Stuck as INSPECTING</H2>
        <UL>
          <li>Restart the application — orphaned INSPECTING rolls are automatically closed to ABORTED on startup.</li>
          <li>Confirm the backend is running before starting a new roll.</li>
        </UL>
        <H2>Recording Fails</H2>
        <UL>
          <li>Ensure the /recordings/ folder exists and is writable.</li>
          <li>Check available disk space.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'about',
    icon: Info,
    title: 'About Magic QC',
    render: () => (
      <>
        <H2>Magic QC v1.0.0</H2>
        <P><strong>Industry 4.0 Fabric Quality Inspection System</strong></P>
        <P>Designed for grey/half-white fabric inspection using the 4-point grading system, compatible with Uster and ASTM D5430 standards.</P>
        <H3>Technology Stack</H3>
        <UL>
          <li><strong>Frontend</strong>: Electron.js + React + TailwindCSS</li>
          <li><strong>Backend</strong>: Python FastAPI + SQLite</li>
          <li><strong>Computer Vision</strong>: OpenCV (classical detection)</li>
          <li><strong>Camera</strong>: MindVision MV-GEL83BM via GigE Vision (mvsdk)</li>
          <li><strong>Charts</strong>: Recharts</li>
        </UL>
        <H3>Fabric Specification</H3>
        <UL>
          <li>Width: 1.37 meters (53.94 inches)</li>
          <li>Type: Grey / Half-white woven fabric</li>
        </UL>
        <H3>Key Conversion</H3>
        <Code>pixels_per_inch = frame_width_pixels ÷ 53.94</Code>
        <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />
        <P>Built for production-line quality control. All data stored locally on-premise with no external network dependency.</P>
      </>
    ),
  },
]

// ── Help page ─────────────────────────────────────────────────────────────────
export default function Help() {
  const [open, setOpen] = useState('getting-started')

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* TOC sidebar */}
      <div className="card flex-shrink-0 py-3" style={{ width: 220 }}>
        <p className="text-xs font-semibold uppercase tracking-widest px-4 mb-3" style={{ color: 'var(--text-muted)' }}>
          Contents
        </p>
        {SECTIONS.map(({ id, icon: Icon, title }) => (
          <button
            key={id}
            onClick={() => setOpen(id)}
            className={`sidebar-link w-full text-left ${open === id ? 'active' : ''}`}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span className="text-xs leading-tight">{title}</span>
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="card flex-1 overflow-y-auto p-8">
        {SECTIONS.filter(s => s.id === open).map(section => (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-6" style={{ paddingBottom: 16, borderBottom: '1.5px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                <section.icon size={18} style={{ color: '#2563EB' }} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{section.title}</h2>
            </div>
            <div style={{ color: 'var(--text-primary)' }}>
              {section.render()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Small typography helpers ──────────────────────────────────────────────────
function H2({ children }) {
  return <h3 className="text-base font-bold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h3>
}
function H3({ children }) {
  return <h4 className="text-sm font-semibold mt-4 mb-1.5" style={{ color: 'var(--text-primary)' }}>{children}</h4>
}
function P({ children }) {
  return <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</p>
}
function UL({ children }) {
  return <ul className="ml-5 mb-3 space-y-1" style={{ listStyleType: 'disc' }}>{children}</ul>
}
function OL({ children }) {
  return <ol className="ml-5 mb-3 space-y-1" style={{ listStyleType: 'decimal' }}>{children}</ol>
}
function Code({ children, inline }) {
  if (inline) {
    return <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: '#2563EB' }}>{children}</code>
  }
  return <pre className="font-mono text-xs px-3 py-2 rounded my-2" style={{ background: 'var(--bg)', color: '#2563EB', overflowX: 'auto' }}>{children}</pre>
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="card overflow-hidden my-4">
      <table className="data-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j} className="text-sm">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

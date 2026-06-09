import React, { useState, useEffect } from 'react'

export default function TitleBar({ pageTitle = '' }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI?.onMaximizeChange((_, maximized) => setIsMaximized(maximized))
  }, [])

  return (
    <div style={{
      height: 36, background: '#264C59',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 16,
      WebkitAppRegion: 'drag',
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 9999, userSelect: 'none', flexShrink: 0,
    }}>
      {/* Left: logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'drag' }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px' }}>
          <span style={{ color: '#fff' }}>Magic</span>
          <span style={{ color: '#F7A536' }}>QC</span>
        </span>
        <span style={{
          fontSize: 13, color: 'rgba(255,255,255,0.4)',
          borderLeft: '1px solid rgba(255,255,255,0.18)',
          paddingLeft: 10, marginLeft: 2,
        }}>
          v1.0.0
        </span>
      </div>

      {/* Center: page title */}
      {pageTitle && (
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 500, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {pageTitle}
        </span>
      )}

      {/* Right: window controls — not draggable */}
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        {/* Minimize */}
        <WinBtn onClick={() => window.electronAPI?.minimizeWindow()} title="Minimize">
          <svg width="11" height="1" viewBox="0 0 11 1">
            <rect width="11" height="1" fill="rgba(255,255,255,0.85)" />
          </svg>
        </WinBtn>

        {/* Maximize / Restore */}
        <WinBtn onClick={() => window.electronAPI?.maximizeWindow()} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M3 1h7v7M1 3h7v7" stroke="rgba(255,255,255,0.85)" strokeWidth="1.1" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="0.5" y="0.5" width="10" height="10" stroke="rgba(255,255,255,0.85)" strokeWidth="1.1" />
            </svg>
          )}
        </WinBtn>

        {/* Close */}
        <WinBtn onClick={() => window.electronAPI?.closeWindow()} title="Close" closeBtn>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <line x1="0.5" y1="0.5" x2="10.5" y2="10.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" />
            <line x1="10.5" y1="0.5" x2="0.5" y2="10.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" />
          </svg>
        </WinBtn>
      </div>
    </div>
  )
}

function WinBtn({ onClick, title, closeBtn, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 46, height: 36, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? (closeBtn ? '#E81123' : 'rgba(255,255,255,0.12)') : 'transparent',
        transition: 'background 0.12s',
        WebkitAppRegion: 'no-drag',
      }}
    >
      {children}
    </button>
  )
}

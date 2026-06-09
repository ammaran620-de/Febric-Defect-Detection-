import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useInspection } from '../../context/InspectionContext'
import { useToast } from '../../context/ToastContext'
import { format } from 'date-fns'
import { Pause, Play, Circle, Download, Radio, MapPin } from 'lucide-react'

const WS_URL = 'ws://127.0.0.1:8000/ws/live-feed'

export default function VideoFeed() {
  const containerRef = useRef(null)
  const feedImgRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const stickerTimers = useRef({})

  const [isPaused, setIsPaused] = useState(false)
  const [feedStatus, setFeedStatus] = useState('connecting') // 'connecting' | 'connected' | 'disconnected'
  const [stickers, setStickers] = useState([])
  const [frameNum, setFrameNum] = useState(0)
  const [fps, setFps] = useState(0)
  const [timestamp, setTimestamp] = useState('')

  const { rollState, isRecording, setIsRecording, demoMode, hasFlash, setFrameCount } = useInspection()
  const { toast } = useToast()

  const handleNewDefects = useCallback((defects, frameW, frameH) => {
    if (!containerRef.current || !feedImgRef.current) return
    const imgRect = feedImgRef.current.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const offsetX = imgRect.left - containerRect.left
    const offsetY = imgRect.top - containerRect.top
    const scaleX = imgRect.width / (frameW || 1280)
    const scaleY = imgRect.height / (frameH || 256)

    const newStickers = defects.map(def => ({
      ...def,
      id: `s-${Date.now()}-${Math.random()}`,
      displayX: def.x * scaleX + offsetX,
      displayY: def.y * scaleY + offsetY,
    }))

    setStickers(prev => [...prev, ...newStickers])
    newStickers.forEach(s => {
      stickerTimers.current[s.id] = setTimeout(() => {
        setStickers(prev => prev.filter(x => x.id !== s.id))
        delete stickerTimers.current[s.id]
      }, 3000)
    })
  }, [])

  // Auto-connect on mount — no waiting for roll start
  useEffect(() => {
    let ws = null

    const connect = () => {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setFeedStatus('connected')
        console.log('[WS] Live feed connected')
      }

      ws.onmessage = (event) => {
        if (isPaused) return
        try {
          const data = JSON.parse(event.data)
          // Update img src directly via ref — bypass React state for performance
          if (feedImgRef.current && data.frame) {
            feedImgRef.current.src = `data:image/jpeg;base64,${data.frame}`
          }
          const fc = data.frame_count ?? data.frame_num ?? 0
          setFrameNum(fc)
          setFrameCount(fc)
          if (data.fps) setFps(data.fps)
          if (data.timestamp) setTimestamp(data.timestamp)
          if (data.defects && data.defects.length > 0) {
            handleNewDefects(data.defects, data.frame_width, data.frame_height)
          }
        } catch (e) {
          console.warn('[WS] Parse error:', e)
        }
      }

      ws.onerror = () => ws.close()

      ws.onclose = () => {
        setFeedStatus('disconnected')
        reconnectTimer.current = setTimeout(connect, 2000)
      }
    }

    connect()

    // Throttle WebSocket when tab is hidden (save CPU)
    const handleVisibilityChange = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ throttle: document.hidden ? 2 : 25 }))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(reconnectTimer.current)
      Object.values(stickerTimers.current).forEach(clearTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      ws?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty — runs once on mount

  const togglePause = () => {
    const next = !isPaused
    setIsPaused(next)
    wsRef.current?.send(JSON.stringify({ command: next ? 'pause' : 'resume' }))
  }

  const toggleRecord = () => {
    if (!isRecording) {
      wsRef.current?.send(JSON.stringify({ command: 'start_recording' }))
      setIsRecording(true)
      toast('Recording started', 'info')
    } else {
      wsRef.current?.send(JSON.stringify({ command: 'stop_recording' }))
      setIsRecording(false)
      toast('Recording stopped', 'success')
    }
  }

  const downloadRecording = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/recordings/latest')
      const data = await res.json()
      if (data.path) {
        toast(`Recording saved: ${data.filename}`, 'success')
      } else {
        toast('No recording available', 'warning')
      }
    } catch {
      toast('No recording available', 'error')
    }
  }

  const displayTime = timestamp || format(new Date(), 'HH:mm:ss')
  const connected = feedStatus === 'connected'

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--bg-surface)', borderBottom: '1.5px solid var(--border-bold)' }}>
        <div className="flex items-center gap-3">
          {feedStatus === 'connected' ? (
            demoMode ? (
              <div className="badge badge-amber font-bold">◈ DEMO MODE</div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--accent-success)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-success)', boxShadow: '0 0 8px var(--accent-success)' }} />
                LIVE
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
              {feedStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </div>
          )}
        </div>
        <div className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
          MV-GEL83BM <span style={{ color: 'var(--text-muted)' }}>| 1280×256</span>
        </div>
        <div className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
          {displayTime} | {fps} fps
        </div>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        className={`relative flex-1 flex items-center justify-center overflow-hidden transition-all duration-200 ${hasFlash ? 'defect-flash-border' : ''}`}
        style={{ background: '#0A0A0A', minHeight: 360 }}
      >
        {feedStatus !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-t-blue-500 rounded-full animate-spin mb-2" />
            <div className="text-sm font-semibold" style={{ color: '#94A3B8' }}>
              {feedStatus === 'connecting' ? 'Initializing feed…' : 'Reconnecting to feed…'}
            </div>
          </div>
        )}

        {/* Use <img> with ref — direct src update, no React re-render lag */}
        <img
          ref={feedImgRef}
          alt="Live fabric feed"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            opacity: feedStatus === 'connected' ? 1 : 0,
          }}
        />

        {/* Defect stickers disabled to keep custom video stream clean */}

        {/* Paused overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div className="text-white text-3xl font-bold tracking-widest">⏸ PAUSED</div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderTop: '1.5px solid var(--border-bold)', background: 'var(--bg-surface)' }}>
        <button
          onClick={togglePause}
          disabled={!connected}
          title={!connected ? 'Feed not connected' : isPaused ? 'Resume feed' : 'Pause feed'}
          className={`btn ${isPaused ? 'btn-primary' : 'btn-ghost'} ${!connected ? 'btn-disabled' : ''}`}
          style={!connected ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={toggleRecord}
          disabled={!connected}
          title={!connected ? 'Feed not connected' : isRecording ? 'Stop recording' : 'Start recording'}
          className={`btn ${isRecording ? 'btn-danger' : 'btn-ghost'} ${!connected ? 'btn-disabled' : ''}`}
          style={!connected ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          <Circle size={14} className={isRecording ? 'animate-pulse' : ''} />
          {isRecording ? 'Stop REC' : 'Record'}
        </button>

        <button
          onClick={downloadRecording}
          disabled={isRecording}
          title={isRecording ? 'Stop recording first to download' : 'Download latest recording'}
          className={`btn btn-ghost ${isRecording ? 'btn-disabled' : ''}`}
          style={isRecording ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          <Download size={14} /> Download
        </button>

        <div className="flex-1" />

        {isRecording && (
          <div className="flex items-center gap-2 font-mono text-sm font-bold" style={{ color: 'var(--accent-danger)' }}>
            <Radio size={14} className="animate-pulse" /> REC
          </div>
        )}
        <div className="font-mono text-sm ml-4 data-value">
          Frame #{frameNum.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

function DefectSticker({ sticker }) {
  const DEFECT_COLORS = {
    Hole: '#EF4444',
    Stain: '#F59E0B',
    'Weft Break': '#8B5CF6',
    'Warp Break': '#3B82F6',
    'Running Defect': '#EA580C',
    Splice: '#10B981',
    Unknown: '#94A3B8',
  }
  const color = DEFECT_COLORS[sticker.defect_type || sticker.type] || '#EF4444'
  const length = sticker.length_inches ?? sticker.length_in ?? 0
  const pts = sticker.penalty_points ?? sticker.points ?? 0

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: sticker.displayX, top: sticker.displayY, transform: 'translate(-50%, -100%)', zIndex: 10 }}
    >
      <div className="flex flex-col items-center">
        <div
          className="px-2 py-1 mb-1 rounded text-xs font-bold whitespace-nowrap shadow-md"
          style={{ background: 'var(--bg-surface)', color, border: `1.5px solid ${color}`, fontSize: '13px', textTransform: 'uppercase' }}
        >
          {sticker.defect_type || sticker.type} · {length.toFixed(1)}" · {pts}pts
        </div>
        <MapPin size={24} color={color} fill={color} />
      </div>
    </div>
  )
}

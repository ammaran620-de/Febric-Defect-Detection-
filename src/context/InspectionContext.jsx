import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useToast } from './ToastContext'
import api from '../lib/api'

const InspectionContext = createContext(null)

const generateRollId = () => {
  const date = format(new Date(), 'yyyyMMdd')
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')
  return `ROLL-${date}-${seq}`
}

export function InspectionProvider({ children }) {
  const { toast, showCritical } = useToast()

  const [rollState, setRollState] = useState({
    isActive: false,
    rollId: null,
    dbRollId: null,
    startTime: null,
    fabricLength: 0,
    totalPoints: 0,
    pointsPer100sqyd: 0,
    threshold: 40,
    fabricWidth: 1.37,
    status: 'IDLE', // IDLE | INSPECTING | PASSED | FAILED
    defects: [],
    operator: 'Default Operator',
  })

  const [isRecording, setIsRecording] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const [frameCount, setFrameCount] = useState(0)
  const [hasFlash, setHasFlash] = useState(false)
  const alertedAt80 = useRef(false)
  const alertedFailed = useRef(false)

  const startRoll = useCallback(async () => {
    const rollId = generateRollId()
    try {
      const res = await api.post('/rolls/start', {
        roll_id: rollId,
        operator: rollState.operator,
        threshold_used: rollState.threshold,
        fabric_width_m: rollState.fabricWidth,
      })
      const dbRollId = res.data.id || rollId
      setRollState(prev => ({
        ...prev,
        isActive: true,
        rollId,
        dbRollId,
        startTime: new Date(),
        fabricLength: 0,
        totalPoints: 0,
        pointsPer100sqyd: 0,
        status: 'INSPECTING',
        defects: [],
      }))
      alertedAt80.current = false
      alertedFailed.current = false
      toast(`Roll ${rollId} started`, 'info')
    } catch (e) {
      // Offline mode - still start locally
      const rollId2 = generateRollId()
      setRollState(prev => ({
        ...prev,
        isActive: true,
        rollId: rollId2,
        dbRollId: null,
        startTime: new Date(),
        fabricLength: 0,
        totalPoints: 0,
        pointsPer100sqyd: 0,
        status: 'INSPECTING',
        defects: [],
      }))
      alertedAt80.current = false
      alertedFailed.current = false
      toast(`Roll started (offline mode)`, 'info')
    }
  }, [rollState.operator, rollState.threshold, rollState.fabricWidth, toast])

  const finishRoll = useCallback(async () => {
    if (!rollState.isActive) return
    let finalResult = rollState.status === 'FAILED' ? 'FAILED' : 'PASSED'
    let pts100 = rollState.pointsPer100sqyd

    try {
      const res = await api.post(`/rolls/${rollState.dbRollId || rollState.rollId}/finish`, {
        fabric_length_m: rollState.fabricLength,
        total_points: rollState.totalPoints,
      })
      if (res.data.result) finalResult = res.data.result
      if (res.data.points_per_100sqyd != null) pts100 = res.data.points_per_100sqyd
    } catch { /* offline — use local result */ }

    toast(
      finalResult === 'PASSED'
        ? `Roll ${rollState.rollId} PASSED — ${pts100.toFixed(2)} pts/100sqyd`
        : `Roll ${rollState.rollId} FAILED — ${pts100.toFixed(2)} pts/100sqyd`,
      finalResult === 'PASSED' ? 'success' : 'error'
    )
    setRollState(prev => ({
      ...prev,
      isActive: false,
      status: 'IDLE',
      rollId: null,
      dbRollId: null,
    }))
  }, [rollState, toast])

  const abortRoll = useCallback(async () => {
    const id = rollState.dbRollId || rollState.rollId
    if (id) {
      try {
        await api.post(`/rolls/${id}/abort`)
      } catch { /* ignore — still clear local state */ }
    }
    toast(`Roll ${rollState.rollId} aborted`, 'warning')
    setRollState(prev => ({
      ...prev,
      isActive: false,
      status: 'IDLE',
      rollId: null,
      dbRollId: null,
    }))
  }, [rollState.dbRollId, rollState.rollId, toast])

  // Called by WebSocket handler with live stats
  const updateStats = useCallback((data) => {
    setRollState(prev => {
      if (!prev.isActive) return prev
      const newPoints = data.total_points ?? prev.totalPoints
      const newLength = data.fabric_length ?? prev.fabricLength
      const w = prev.fabricWidth
      const pts100 = w > 0 && newLength > 0
        ? (newPoints / (w * newLength * 1.19599)) * 100
        : 0

      let newStatus = prev.status
      if (newPoints > prev.threshold && prev.status !== 'FAILED') {
        newStatus = 'FAILED'
      }

      // Threshold alerts
      const pct = (newPoints / prev.threshold) * 100
      if (pct >= 80 && !alertedAt80.current) {
        alertedAt80.current = true
        toast(`Approaching penalty limit — ${newPoints} / ${prev.threshold} pts`, 'warning', 'Warning')
      }
      if (newStatus === 'FAILED' && !alertedFailed.current) {
        alertedFailed.current = true
        showCritical(
          'Roll FAILED',
          `Roll FAILED — ${pts100.toFixed(2)} pts/100sqyd exceeds threshold of ${prev.threshold}`
        )
      }

      return {
        ...prev,
        totalPoints: newPoints,
        fabricLength: newLength,
        pointsPer100sqyd: pts100,
        status: newStatus,
      }
    })
  }, [toast, showCritical])

  const addDefect = useCallback((defect) => {
    setRollState(prev => {
      if (!prev.isActive) return prev
      const newDefects = [
        { ...defect, index: prev.defects.length + 1 },
        ...prev.defects,
      ].slice(0, 200) // keep last 200
      return { ...prev, defects: newDefects }
    })
    setHasFlash(true)
    setTimeout(() => setHasFlash(false), 1500)
  }, [])

  return (
    <InspectionContext.Provider value={{
      rollState,
      isRecording,
      setIsRecording,
      demoMode,
      setDemoMode,
      frameCount,
      setFrameCount,
      hasFlash,
      startRoll,
      finishRoll,
      abortRoll,
      updateStats,
      addDefect,
    }}>
      {children}
    </InspectionContext.Provider>
  )
}

export function useInspection() {
  return useContext(InspectionContext)
}

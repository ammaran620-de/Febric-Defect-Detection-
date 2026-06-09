import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { X, AlertCircle } from 'lucide-react'

const ToastContext = createContext(null)

const TOAST_STYLES = {
  success: { borderLeft: '4px solid #10B981', icon: '✓', color: '#10B981' },
  warning: { borderLeft: '4px solid #F59E0B', icon: '⚠', color: '#F59E0B' },
  error:   { borderLeft: '4px solid #EF4444', icon: '✕', color: '#EF4444' },
  info:    { borderLeft: '4px solid #3B82F6', icon: 'ℹ', color: '#3B82F6' },
}

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [criticalModal, setCriticalModal] = useState(null)

  const toast = useCallback((message, type = 'info', title = null) => {
    const id = ++toastId
    const duration = (type === 'error') ? 8000 : 5000
    
    setToasts(prev => {
      const next = [...prev, { id, message, type, title }]
      if (next.length > 3) {
        return next.slice(next.length - 3)
      }
      return next
    })
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
    return id
  }, [])

  const showCritical = useCallback((title, message, onAck) => {
    setCriticalModal({ title, message, onAck })
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, showCritical }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const style = TOAST_STYLES[t.type] || TOAST_STYLES.info
          return (
            <div 
              key={t.id} 
              className="flex items-start gap-3 p-3 rounded-lg shadow-lg pointer-events-auto transition-all animate-fadeIn"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-bold)',
                borderLeft: style.borderLeft,
                width: 300
              }}
            >
              <div className="flex-shrink-0 font-bold" style={{ color: style.color }}>
                {style.icon}
              </div>
              <div className="flex-1 flex flex-col pt-0.5">
                {t.title && <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.title}</span>}
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.message}</span>
              </div>
              <button onClick={() => dismissToast(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Critical Alert Modal */}
      {criticalModal && (
        <div className="modal-overlay">
          <div className="modal-panel w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <AlertCircle size={20} style={{ color: 'var(--accent-danger)' }} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {criticalModal.title}
                </h3>
                <p className="text-sm uppercase font-bold" style={{ color: 'var(--accent-danger)', letterSpacing: 1 }}>CRITICAL ALERT</p>
              </div>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {criticalModal.message}
            </p>
            <button
              className="btn btn-danger w-full justify-center py-2"
              onClick={() => {
                criticalModal.onAck?.()
                setCriticalModal(null)
              }}
            >
              Acknowledge & Continue
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

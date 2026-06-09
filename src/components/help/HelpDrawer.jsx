import React from 'react'
import { X } from 'lucide-react'
import Help from '../../pages/Help'

export default function HelpDrawer({ onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="help-drawer" style={{ zIndex: 900 }}>
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ background: 'var(--card)', borderBottom: '1.5px solid var(--border)', zIndex: 1 }}
        >
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Help Center</h2>
          <button onClick={onClose} className="btn btn-ghost py-1 px-2">
            <X size={15} />
          </button>
        </div>
        <div className="p-4">
          <Help />
        </div>
      </div>
    </>
  )
}

import React from 'react'
import VideoFeed from '../components/inspection/VideoFeed'
import RollStatsPanel from '../components/inspection/RollStatsPanel'

export default function LiveInspection() {
  return (
    <div className="flex h-full rounded-xl overflow-hidden" style={{ minHeight: 0, border: '1.5px solid var(--border-bold)' }}>
      {/* Video Feed — 68% */}
      <div className="flex flex-col bg-black" style={{ flex: '68', minHeight: 0 }}>
        <VideoFeed />
      </div>

      {/* Roll Stats — 32% */}
      <div className="flex flex-col bg-white dark:bg-[#111]" style={{ flex: '32', minHeight: 0 }}>
        <RollStatsPanel />
      </div>
    </div>
  )
}

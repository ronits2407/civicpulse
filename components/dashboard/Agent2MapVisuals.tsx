'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Issue } from '@/lib/db/types'
import { Loader2 } from 'lucide-react'

// Dynamically import the map so it doesn't cause SSR issues
const Agent2MapInner = dynamic(() => import('./Agent2MapInner'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/50">
      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
    </div>
  )
})

interface Props {
  issue: Issue
  allIssues: Issue[]
  agentState: string
  children?: React.ReactNode // The "Done" state UI to show after animation
}

export function Agent2MapVisuals({ issue, allIssues, agentState, children }: Props) {
  const [showAnimation, setShowAnimation] = useState(false)
  const [timerFinished, setTimerFinished] = useState(false)

  useEffect(() => {
    if ((agentState === 'in_progress' || agentState === 'done') && !showAnimation) {
      setShowAnimation(true)
    }
  }, [agentState, showAnimation])

  useEffect(() => {
    if (showAnimation && !timerFinished) {
      // Enforce a minimum 6-second animation time
      const timer = setTimeout(() => {
        setTimerFinished(true)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [showAnimation, timerFinished])

  // If the timer is finished AND the agent is no longer running, hide the animation and show results
  const isCurrentlyAnimating = showAnimation && (!timerFinished || agentState === 'in_progress')

  if (!showAnimation) return null

  if (!isCurrentlyAnimating) {
    return <div className="mt-3">{children}</div>
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-border bg-black/50 shadow-[0_0_20px_rgba(0,0,0,0.5)_inset]">
        <Agent2MapInner issue={issue} allIssues={allIssues} />
        
        {/* Overlay Badge */}
        <div className="absolute bottom-2 left-2 z-[1000]">
          <span className="bg-black/80 text-[#0969da] text-[10px] font-bold px-2 py-1 rounded border border-[#0969da]/50 uppercase tracking-widest backdrop-blur-sm flex items-center gap-1.5 shadow-[0_0_10px_rgba(9,105,218,0.3)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Vector & Proximity Scan
          </span>
        </div>
      </div>
    </div>
  )
}

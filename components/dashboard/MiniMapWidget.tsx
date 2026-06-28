'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Globe, RefreshCw, Loader2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MapIssue } from './IssueMapInner'

const IssueMapInner = dynamic(() => import('./IssueMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1117]">
      <Loader2 className="w-6 h-6 text-[#2da44e] animate-spin" />
      <span className="text-[10px] text-muted-foreground mt-2 font-medium">Loading map...</span>
    </div>
  ),
})

interface MiniMapWidgetProps {
  onOpenFullMap: () => void
  userLocation: { lat: number; lng: number } | null
}

export function MiniMapWidget({ onOpenFullMap, userLocation }: MiniMapWidgetProps) {
  const [issues, setIssues] = useState<MapIssue[]>([])
  const [loading, setLoading] = useState(false)
  const hasFetched = useRef(false)

  async function fetchIssues() {
    setLoading(true)
    try {
      const res = await fetch('/api/issues/map')
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (err) {
      console.error('Failed to load map data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchIssues()
    }
  }, [])

  return (
    <div className="relative h-64 overflow-hidden isolate border border-border shadow-sm rounded-xl p-0 m-0">
      {/* Floating Action Buttons */}
      <div className="absolute top-3 right-3 z-[2000] flex flex-col gap-2 pointer-events-auto">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-card/90 backdrop-blur-sm text-foreground border-border shadow-md hover:bg-card"
          onClick={fetchIssues}
          disabled={loading}
          title="Refresh map data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-card/90 backdrop-blur-sm text-foreground border-border shadow-md hover:bg-card"
          onClick={onOpenFullMap}
          title="Expand map"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* The map takes full height/width of the card, and is pannable */}
      <IssueMapInner issues={issues} userLocation={userLocation} />
    </div>
  )
}

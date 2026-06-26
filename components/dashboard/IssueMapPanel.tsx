'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Globe, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MapIssue } from './IssueMapInner'

// Dynamically import the Leaflet inner map — never rendered server-side
const IssueMapInner = dynamic(() => import('./IssueMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117] rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#2da44e] animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Loading map engine…</span>
      </div>
    </div>
  ),
})

interface Props {
  isOpen: boolean
  onClose: () => void
  userLocation: { lat: number; lng: number } | null
}

export function IssueMapPanel({ isOpen, onClose, userLocation }: Props) {
  const [issues, setIssues] = useState<MapIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  async function fetchIssues() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/issues/map')
      if (!res.ok) throw new Error(`Failed to load map data (${res.status})`)
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch once when panel is first opened
  useEffect(() => {
    if (isOpen && !hasFetched.current) {
      hasFetched.current = true
      fetchIssues()
    }
  }, [isOpen])

  // Derived stats
  const clusteredCount = issues.filter((i) => i.cluster_id).length
  const standaloneCount = issues.length - clusteredCount

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-background border-border text-foreground w-[95vw] max-w-5xl sm:max-w-5xl p-0 rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2da44e]/10 border border-[#2da44e]/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#2da44e]" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground leading-none">
                City-Wide Issue Map
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                {loading
                  ? 'Loading civic reports…'
                  : error
                  ? 'Failed to load data'
                  : `${issues.length} active reports — ${standaloneCount} standalone · ${clusteredCount > 0 ? `${clusteredCount} in clusters` : 'no clusters'}`}
              </DialogDescription>
            </div>
          </div>

          {/* Legend + Refresh */}
          <div className="flex items-center gap-3">
            {/* Category Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
              {[
                { label: 'Infra', color: '#0969da' },
                { label: 'Sanitation', color: '#34d399' },
                { label: 'Safety', color: '#f87171' },
                { label: 'Utility', color: '#fbbf24' },
                { label: 'Env', color: '#2dd4bf' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  {label}
                </span>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => {
                hasFetched.current = false
                fetchIssues()
              }}
              disabled={loading}
              title="Refresh map data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Map area */}
        <div className="relative" style={{ height: 'calc(85vh - 73px)' }}>
          {loading && issues.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117]">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-[#2da44e]/20 border-t-[#2da44e] animate-spin" />
                <Globe className="absolute inset-0 m-auto w-6 h-6 text-[#2da44e]" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Loading city data…</p>
              <p className="mt-1 text-xs text-muted-foreground">Fetching civic issue pins</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Map failed to load</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
              <Button
                size="sm"
                className="bg-[#2da44e] hover:bg-[#2c974b] text-foreground text-xs h-8"
                onClick={() => {
                  hasFetched.current = false
                  fetchIssues()
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : (
            <IssueMapInner issues={issues} userLocation={userLocation} />
          )}

          {/* Cluster legend overlay — bottom left */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-[#0d1117]/90 border border-[#30363d] rounded-xl px-3 py-2.5 backdrop-blur-sm shadow-lg">
            <p className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider mb-2">Map Legend</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[10px] text-[#e6edf3] font-medium">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10"
                  style={{ background: '#2da44e' }}
                />
                Your location
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#e6edf3] font-medium">
                <div className="w-3.5 h-3.5 rounded-sm rotate-45 shrink-0 border border-white/10"
                  style={{ background: '#0969da' }} />
                Single issue pin
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#e6edf3] font-medium">
                <div
                  className="w-4 h-4 rounded-full shrink-0 border-2"
                  style={{ borderColor: '#0969da', background: '#0969da18' }}
                />
                Cluster (Agent 2)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

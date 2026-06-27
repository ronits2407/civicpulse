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
import { Map, Loader2, RefreshCw, AlertCircle, Navigation, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

const RoutePlannerMapInner = dynamic(() => import('./RoutePlannerMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117] rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#2da44e] animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Loading route engine…</span>
      </div>
    </div>
  ),
})

interface Props {
  isOpen: boolean
  onClose: () => void
  userLocation: { lat: number; lng: number } | null
}

export function RoutePlannerPanel({ isOpen, onClose, userLocation }: Props) {
  const [clusters, setClusters] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [activeRoute, setActiveRoute] = useState<any | null>(null)

  const hasFetched = useRef(false)

  async function fetchClusters() {
    setLoading(true)
    setError(null)
    setActiveRoute(null)
    setSelectedClusterId(null)
    try {
      const res = await fetch('/api/admin/clusters')
      if (!res.ok) throw new Error(`Failed to load clusters (${res.status})`)
      const data = await res.json()
      setClusters(data.clusters || [])
      
      // Select the nearest cluster by default if userLocation exists
      if (userLocation && data.clusters && data.clusters.length > 0) {
        let nearestId = data.clusters[0].id
        let minDistance = Infinity
        for (const c of data.clusters) {
           const dLat = c.centroid.lat - userLocation.lat
           const dLng = c.centroid.lng - userLocation.lng
           const dist = dLat*dLat + dLng*dLng
           if (dist < minDistance) {
             minDistance = dist
             nearestId = c.id
           }
        }
        setSelectedClusterId(nearestId)
      } else if (data.clusters && data.clusters.length > 0) {
        setSelectedClusterId(data.clusters[0].id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && !hasFetched.current) {
      hasFetched.current = true
      fetchClusters()
    }
  }, [isOpen])

  const handleGenerateRoute = async () => {
    if (!selectedClusterId) return
    const cluster = clusters.find(c => c.id === selectedClusterId)
    if (!cluster) return

    setRouteLoading(true)
    try {
      const origin = userLocation || { lat: 19.9975, lng: 73.7898 } // fallback Nashik
      const waypoints = cluster.issues.map((i: any) => i.location)
      
      const res = await fetch('/api/admin/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, waypoints })
      })

      if (!res.ok) {
         const err = await res.json()
         throw new Error(err.error || 'Failed to optimize route')
      }

      const data = await res.json()
      // data: distanceMeters, duration, encodedPolyline, optimizedWaypointIndices
      setActiveRoute(data)

    } catch (err: any) {
       console.error(err)
       alert(err.message)
    } finally {
      setRouteLoading(false)
    }
  }

  const selectedCluster = clusters.find(c => c.id === selectedClusterId)
  
  // Create a display order for issues if a route is active
  let orderedIssues = selectedCluster ? [...selectedCluster.issues] : []
  if (activeRoute && activeRoute.optimizedWaypointIndices && activeRoute.optimizedWaypointIndices.length > 0 && orderedIssues.length > 0) {
     const newOrder = []
     for (const idx of activeRoute.optimizedWaypointIndices) {
       if (orderedIssues[idx] !== undefined) {
         newOrder.push(orderedIssues[idx])
       }
     }
     // Only use newOrder if it matched everything, otherwise fallback to original to prevent missing data
     if (newOrder.length === orderedIssues.length) {
       orderedIssues = newOrder
     }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-background border-border text-foreground w-[95vw] max-w-5xl sm:max-w-5xl p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row h-[85vh]"
      >
        {/* Sidebar */}
        <div className="w-full sm:w-[350px] border-r border-border bg-card/60 flex flex-col h-full z-10 shrink-0">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Map className="w-4 h-4 text-[#0969da]" /> Admin Route Planner
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Select a cluster to generate an optimized route.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
             {loading ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0969da]" />
                  <span className="text-[11px] font-medium">Clustering Issues...</span>
                </div>
             ) : error ? (
                <div className="text-rose-400 text-xs p-3 bg-rose-500/10 rounded-lg border border-rose-500/20">
                  {error}
                </div>
             ) : (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Identified Clusters ({clusters.length})</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {clusters.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClusterId(c.id); setActiveRoute(null); }}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          selectedClusterId === c.id 
                            ? 'bg-[#0969da]/10 border-[#0969da]/40 ring-1 ring-[#0969da]' 
                            : 'bg-background hover:bg-muted border-border'
                        }`}
                      >
                         <div className="text-[10px] font-semibold text-foreground">Cluster {i + 1}</div>
                         <div className="text-[9px] text-muted-foreground mt-0.5">{c.issues.length} Issues</div>
                      </button>
                    ))}
                  </div>

                  {selectedCluster && (
                    <div className="pt-4 border-t border-border mt-4">
                       <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Selected: Cluster {clusters.indexOf(selectedCluster) + 1}</h3>
                       
                       <Button 
                         onClick={handleGenerateRoute}
                         disabled={routeLoading}
                         className="w-full bg-[#0969da] hover:bg-blue-600 text-white font-semibold text-xs h-9"
                       >
                         {routeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
                         Generate Optimal Route
                       </Button>

                       {activeRoute && (
                          <div className="mt-4 p-3 bg-[#2da44e]/10 border border-[#2da44e]/20 rounded-xl space-y-2">
                             <div className="flex justify-between items-center text-xs font-semibold text-[#2da44e]">
                               <span>Total ETA</span>
                               <span>{Math.round(parseInt(activeRoute.duration) / 60)} mins</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-semibold text-[#2da44e]">
                               <span>Total Distance</span>
                               <span>{(activeRoute.distanceMeters / 1000).toFixed(1)} km</span>
                             </div>
                          </div>
                       )}

                       <div className="mt-4 space-y-2">
                          <h4 className="text-[10px] font-semibold text-muted-foreground">Waypoints ({orderedIssues.length})</h4>
                          <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                             {orderedIssues.map((issue, idx) => (
                               <div key={issue.id} className="flex gap-2 p-2 bg-background border border-border rounded-lg items-start">
                                 <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5">
                                   {idx + 1}
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-semibold text-foreground line-clamp-1">{issue.title || issue.category}</p>
                                    <p className="text-[9px] text-muted-foreground line-clamp-1">{issue.address}</p>
                                 </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )}
                </div>
             )}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative h-full">
           <RoutePlannerMapInner 
             clusters={clusters} 
             selectedClusterId={selectedClusterId}
             userLocation={userLocation}
             activeRoute={activeRoute}
           />
           <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-[1000] bg-[#0d1117]/80 border border-[#30363d] backdrop-blur text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={fetchClusters}
              disabled={loading}
              title="Refresh Clusters"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

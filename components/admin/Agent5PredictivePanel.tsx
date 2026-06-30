'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Map, Loader2, Sparkles, BrainCircuit, Activity, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Agent5PredictiveMapInner = dynamic(() => import('./Agent5PredictiveMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117] rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#0969da] animate-spin" />
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

export function Agent5PredictivePanel({ isOpen, onClose, userLocation }: Props) {
  const [lookbackDays, setLookbackDays] = useState<number>(30)
  const [step, setStep] = useState<'idle' | 'fetching' | 'analyzing' | 'done'>('idle')
  const [clusters, setClusters] = useState<any[]>([])
  const [currentClusterId, setCurrentClusterId] = useState<string | null>(null)
  const [analyzedCount, setAnalyzedCount] = useState<number>(0)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const [isFetchingInitial, setIsFetchingInitial] = useState(false)
  const [centerTrigger, setCenterTrigger] = useState(0)
  const hasFetched = useRef(false)

  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep('idle')
      setClusters([])
      setCurrentClusterId(null)
      setAnalyzedCount(0)
      setResults([])
      setError(null)
      hasFetched.current = false
    }
  }, [isOpen])

  const fetchClusters = async () => {
    setIsFetchingInitial(true)
    setError(null)
    setClusters([])
    setResults([])
    setAnalyzedCount(0)
    setCurrentClusterId(null)
    setStep('idle')

    try {
      const fetchRes = await fetch('/api/admin/predictive/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays, bbox: null })
      })
      
      if (!fetchRes.ok) {
        const errData = await fetchRes.json()
        throw new Error(errData.error || 'Failed to fetch clusters')
      }

      const { clusters: fetchedClusters } = await fetchRes.json()
      setClusters(fetchedClusters || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsFetchingInitial(false)
    }
  }

  useEffect(() => {
    if (isOpen && !hasFetched.current) {
      hasFetched.current = true
      fetchClusters()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && step === 'idle' && hasFetched.current) {
      fetchClusters()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookbackDays])

  const handleRunAnalysis = async () => {
    if (clusters.length === 0) {
      setStep('done')
      return
    }

    setStep('analyzing')
    setError(null)
    setResults([])
    setAnalyzedCount(0)

    try {
      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i]
        setCurrentClusterId(cluster.id)
        
        // Add a small artificial delay so the UI isn't instantaneous for very fast API responses
        // giving the user time to see the map zoom and focus on the cluster
        await new Promise(r => setTimeout(r, 800))

        const analyzeRes = await fetch('/api/admin/predictive/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cluster })
        })

        if (analyzeRes.ok) {
          const { alerts } = await analyzeRes.json()
          if (alerts && alerts.length > 0) {
            setResults(prev => [...prev, ...alerts])
          }
        } else {
          console.error(`Failed to analyze cluster ${cluster.id}`)
        }
        
        setAnalyzedCount(i + 1)
      }

      setCurrentClusterId(null)
      setStep('done')

    } catch (err: any) {
      setError(err.message)
      setStep('idle')
    }
  }

  const mapArea = (
    <>
      <Agent5PredictiveMapInner 
        clusters={clusters} 
        currentClusterId={currentClusterId}
        userLocation={userLocation}
        centerTrigger={centerTrigger}
      />
      <div className="absolute right-4 top-4 flex flex-col gap-2 z-[1000]">
        <Button
          variant="ghost"
          size="icon"
          className="bg-[#0d1117]/80 border border-[#30363d] backdrop-blur text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={fetchClusters}
          disabled={isFetchingInitial || step !== 'idle'}
          title="Refresh Clusters"
        >
          <RefreshCw className={`w-4 h-4 ${isFetchingInitial ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="absolute right-4 bottom-4 z-[1000]">
        <button
          onClick={() => setCenterTrigger(c => c + 1)}
          title="Center map on your location"
          style={{
            width: 36,
            height: 36,
            background: '#161b22',
            border: '2px solid #30363d',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.55)',
            color: '#2da44e',
            transition: 'color 0.2s, box-shadow 0.2s',
            outline: 'none',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(45,164,78,0.25), 0 2px 10px rgba(0,0,0,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.55)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="7" />
            <line x1="12" y1="17" x2="12" y2="22" />
            <line x1="2" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>
    </>
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-background border-border text-foreground w-[95vw] max-w-6xl sm:max-w-6xl p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row h-[85vh]"
      >
        {/* Sidebar */}
        <div className="w-full sm:w-[400px] border-r border-border bg-card/60 flex flex-col h-full z-10 shrink-0">
          <div className="p-4 border-b border-border bg-card/80">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-[#0969da]" /> Predictive Hotspot Intelligence
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Agent 5 utilizes DBSCAN clustering on historical reports, applying Gemini Pro's reasoning to generate early-warning alerts for civic issues.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
             
            {step === 'idle' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Lookback Period</label>
                  <select
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-[#0969da]"
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(Number(e.target.value))}
                    disabled={step !== 'idle'}
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days (1 Month)</option>
                    <option value={90}>Last 90 Days (3 Months)</option>
                    <option value={180}>Last 180 Days (6 Months)</option>
                  </select>
                </div>
                
                {error && (
                  <div className="text-rose-400 text-xs p-3 bg-rose-500/10 rounded-lg border border-rose-500/20">
                    {error}
                  </div>
                )}

                <Button 
                  onClick={handleRunAnalysis}
                  disabled={isFetchingInitial || clusters.length === 0}
                  className="w-full bg-[#0969da] hover:bg-blue-600 text-white font-semibold text-xs h-10 disabled:opacity-50"
                >
                  {isFetchingInitial ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gathering issues...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Start Predictive Analysis</>
                  )}
                </Button>
              </div>
            )}

            {step !== 'idle' && (
              <div className="space-y-4">
                <div className="bg-background border border-border rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'fetching' ? 'bg-[#0969da]/20 text-[#0969da] animate-pulse' : 'bg-[#2da44e]/20 text-[#2da44e]'}`}>
                      {step === 'fetching' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-foreground">1. Data Retrieval & Clustering</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {step === 'fetching' ? 'Fetching and applying DBSCAN...' : `Found ${clusters.length} hotspots`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'analyzing' ? 'bg-amber-500/20 text-amber-500 animate-pulse' : step === 'done' ? 'bg-[#2da44e]/20 text-[#2da44e]' : 'bg-muted text-muted-foreground'}`}>
                      {step === 'analyzing' ? <Activity className="w-3 h-3 animate-spin" /> : step === 'done' ? <ShieldAlert className="w-3 h-3" /> : <Loader2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-foreground">2. AI Cluster Analysis</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {step === 'analyzing' ? `Analyzing ${analyzedCount} of ${clusters.length} hotspots...` : step === 'done' ? `Analysis complete (${results.length} alerts generated)` : 'Waiting...'}
                      </p>
                    </div>
                  </div>
                </div>

                {isMobile && (
                  <div className="w-full h-[250px] relative mt-4 rounded-xl overflow-hidden border border-border">
                    {mapArea}
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                      Generated Alerts
                      <span className="bg-[#0969da]/20 text-[#0969da] px-1.5 py-0.5 rounded text-[9px]">{results.length}</span>
                    </h4>
                    <div className="space-y-2.5">
                      {results.map((alert, idx) => (
                        <div key={idx} className="bg-background border border-border rounded-lg p-3 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h5 className="text-xs font-bold text-amber-400 capitalize flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {alert.predicted_category.replace(/_/g, ' ')}
                              </h5>
                              <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {(alert.confidence * 100).toFixed(0)}% Conf.
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1.5">
                              {alert.basis_summary}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {step === 'done' && (
                  <Button 
                    onClick={() => setStep('idle')}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs h-9 mt-4"
                  >
                    Run New Analysis
                  </Button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Map Area */}
        {!isMobile && (
          <div className="flex-1 relative h-full hidden sm:block">
             {mapArea}
             
             {step === 'analyzing' && currentClusterId && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#0d1117]/90 border border-[#0969da]/30 shadow-[0_0_15px_rgba(9,105,218,0.2)] backdrop-blur px-4 py-2 rounded-full flex items-center gap-2">
                 <Loader2 className="w-4 h-4 text-[#0969da] animate-spin" />
                 <span className="text-xs font-semibold text-white tracking-wide">
                   Agent 5 examining Hotspot <span className="text-[#0969da] ml-1">{analyzedCount + 1}/{clusters.length}</span>
                 </span>
               </div>
             )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

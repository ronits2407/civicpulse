'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Issue, Profile, Department } from '@/lib/db/types'
import {
  Plus,
  LogOut,
  Star,
  MapPin,
  Clock,
  ChevronRight,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Award,
  Building,
  ShieldCheck,
  Zap,
  Leaf,
  Trash2,
  Wrench,
  ShieldAlert,
  Calendar,
  TrendingUp,
  Sparkles,
  Cpu,
  Database,
  ArrowUpRight,
  ExternalLink,
  Activity,
  CheckSquare,
  Info,
  FileText,
  Loader2,
  Globe,
  AlertTriangle,
  Share2,
  MinusCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { IssueMapPanel } from './IssueMapPanel'
import { Agent2MapVisuals } from './Agent2MapVisuals'
import { CitizenLeaderboardPanel } from './CitizenLeaderboardPanel'
import { MiniMapWidget } from './MiniMapWidget'

// Categories metadata for styling
const CATEGORY_DETAILS: Record<string, { icon: any; label: string; color: string; bgColor: string; borderColor: string }> = {
  infrastructure: {
    icon: Wrench,
    label: 'Infrastructure',
    color: 'text-[#0969da]',
    bgColor: 'bg-blue-950/40',
    borderColor: 'border-blue-900/30'
  },
  sanitation: {
    icon: Trash2,
    label: 'Sanitation',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40',
    borderColor: 'border-emerald-900/30'
  },
  safety: {
    icon: ShieldAlert,
    label: 'Safety',
    color: 'text-red-400',
    bgColor: 'bg-red-950/40',
    borderColor: 'border-red-900/30'
  },
  utilities: {
    icon: Zap,
    label: 'Utilities',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/40',
    borderColor: 'border-amber-900/30'
  },
  environment: {
    icon: Leaf,
    label: 'Environment',
    color: 'text-teal-400',
    bgColor: 'bg-teal-950/40',
    borderColor: 'border-teal-900/30'
  },
  miscellaneous: {
    icon: Info,
    label: 'Miscellaneous',
    color: 'text-slate-400',
    bgColor: 'bg-slate-950/40',
    borderColor: 'border-slate-900/30'
  }
}

// Status styling mapping
const STATUS_DETAILS: Record<string, { label: string; bgClass: string; borderClass: string; textClass: string; dotClass: string }> = {
  open: {
    label: 'Under Review',
    bgClass: 'bg-blue-950/30',
    borderClass: 'border-blue-900/30',
    textClass: 'text-[#0969da]',
    dotClass: 'bg-blue-500'
  },
  in_progress: {
    label: 'In Progress',
    bgClass: 'bg-amber-950/30',
    borderClass: 'border-amber-900/30',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-500'
  },
  resolved: {
    label: 'Resolved',
    bgClass: 'bg-emerald-950/30',
    borderClass: 'border-emerald-900/30',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-500'
  },
  false_closure: {
    label: 'Disputed',
    bgClass: 'bg-rose-950/30',
    borderClass: 'border-rose-900/30',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-500'
  },
  closed: {
    label: 'Closed',
    bgClass: 'bg-card/40',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    dotClass: 'bg-slate-500'
  }
}

function getKarmaLevel(score: number) {
  if (score >= 300) return { name: 'Civic Ambassador', level: 4, min: 300, max: 1000, next: 'Max Level' }
  if (score >= 150) return { name: 'Civic Champion', level: 3, min: 150, max: 300, next: 'Civic Ambassador' }
  if (score >= 50) return { name: 'Civic Guardian', level: 2, min: 50, max: 150, next: 'Civic Champion' }
  return { name: 'Civic Observer', level: 1, min: 0, max: 50, next: 'Civic Guardian' }
}

export type PipelineState = 'done' | 'in_progress' | 'pending' | 'failed' | 'skipped'

const getAgentState = (currentStage: string | null, targetStage: string, isDuplicate?: boolean): PipelineState => {
  if (isDuplicate && (targetStage === 'agent3_validation' || targetStage === 'agent4_resolution' || targetStage === 'agent5_predictive')) {
    return 'skipped'
  }

  const stages = ['agent0_translation', 'agent1_classifier', 'agent2_deduplication', 'agent3_validation', 'awaiting_community_review', 'agent4_resolution', 'completed']
  const cleanCurrentStage = currentStage?.replace('_failed', '') || ''
  const currentIndex = currentStage ? stages.indexOf(cleanCurrentStage) : -1
  const targetIndex = stages.indexOf(targetStage)

  if (currentStage === `${targetStage}_failed`) return 'failed'
  if (currentIndex > targetIndex || currentStage === 'completed') return 'done'
  if (currentIndex === targetIndex && !currentStage?.endsWith('_failed')) return 'in_progress'
  return 'pending'
}

const AgentDot = ({ state }: { state: PipelineState }) => {
  if (state === 'done') return <div className="absolute -left-[33px] top-0.5 bg-[#2da44e] border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/30" />
  if (state === 'in_progress') return <div className="absolute -left-[33px] top-0.5 bg-amber-400 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-amber-500/30 animate-pulse" />
  if (state === 'failed') return <div className="absolute -left-[33px] top-0.5 bg-rose-500 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-rose-500/30" />
  if (state === 'skipped') return <div className="absolute -left-[33px] top-0.5 bg-slate-600 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-slate-500/30" />
  return <div className="absolute -left-[33px] top-0.5 bg-slate-800 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md opacity-40" />
}

const AgentStatusBadge = ({ state, issueId, onRetry }: { state: PipelineState, issueId: string, onRetry: (issueId: string) => void }) => {
  if (state === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20 uppercase tracking-wide leading-none">FAILED</span>
        <button
          onClick={() => onRetry(issueId)}
          className="text-[9px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-600 transition-colors uppercase cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }
  if (state === 'done') {
    return <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
  }
  if (state === 'skipped') {
    return <span className="text-[9px] font-bold text-slate-400 bg-slate-500/10 px-1.5 py-0.2 rounded border border-slate-500/20 uppercase tracking-wide leading-none">SKIPPED</span>
  }
  if (state === 'in_progress') {
    return <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 uppercase tracking-wide flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> IN PROGRESS</span>
  }
  return <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border uppercase tracking-wide leading-none">PENDING</span>
}

interface Props {
  user: any
  profile: Profile | null
  initialIssues: Issue[]
  departments: Department[]
}

function Agent1Visuals({ issue, isRunning }: { issue: Issue, isRunning: boolean }) {
  const [spinCategory, setSpinCategory] = useState('Analyzing...')
  const [spinSeverity, setSpinSeverity] = useState(0)

  useEffect(() => {
    if (isRunning) {
      const categories = ['Infrastructure', 'Sanitation', 'Safety', 'Environment', 'Utilities', 'Miscellaneous']
      const interval = setInterval(() => {
        setSpinCategory(categories[Math.floor(Math.random() * categories.length)])
        setSpinSeverity(Math.floor(Math.random() * 10) + 1)
      }, 700)
      return () => clearInterval(interval)
    }
  }, [isRunning])

  const imageAnalysisText = issue.image_analysis;

  return (
    <div className="mt-3 space-y-3">
      {issue.photo_url && (
        <div className="relative w-full h-32 sm:h-40 rounded-xl overflow-hidden border border-border bg-black/50">
          <img src={issue.photo_url} className={`w-full h-full object-cover transition-all duration-500 ${isRunning ? 'opacity-50 grayscale' : 'opacity-100'}`} alt="Scanning" />
          {isRunning && (
            <>
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-0 w-full h-[2px] bg-[#0969da] shadow-[0_0_15px_3px_rgba(9,105,218,0.8)] z-10"
              />
              <div className="absolute inset-0 bg-[#0969da]/10 animate-pulse mix-blend-overlay" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/70 text-[#0969da] text-[10px] font-bold px-2 py-1 rounded border border-[#0969da]/50 uppercase tracking-widest backdrop-blur-sm flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning Vision Model
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 bg-card/30 p-2.5 rounded-lg border border-border text-[10px] overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center w-[170px] shrink-0">
            <span className="text-muted-foreground font-semibold">Subcategory:</span>
            <span className={`ml-1 font-medium capitalize transition-colors flex ${isRunning ? 'text-[#0969da] font-mono' : 'text-muted-foreground'}`}>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={isRunning ? spinCategory : (issue.subcategory || 'N/A')}
                  initial={{ y: 15, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -15, opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4 }}
                  className="inline-block"
                >
                  {isRunning ? spinCategory : (issue.subcategory || 'N/A')}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">Severity Score:</span>
            <span className={`font-bold transition-colors flex items-center ${isRunning ? 'text-[#0969da] font-mono' : (issue.severity >= 7 ? 'text-rose-500' : issue.severity >= 4 ? 'text-amber-500' : 'text-emerald-500')}`}>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={isRunning ? spinSeverity : issue.severity}
                  initial={{ y: 15, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -15, opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4 }}
                  className="inline-block"
                >
                  {isRunning ? spinSeverity : issue.severity}
                </motion.span>
              </AnimatePresence>
              <span>/10</span>
            </span>
            <div className="w-16 bg-background rounded-full h-1.5 border border-border overflow-hidden shrink-0 ml-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isRunning ? 'bg-[#0969da]' : (issue.severity >= 7 ? 'bg-rose-500' : issue.severity >= 4 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                style={{ width: `${isRunning ? spinSeverity * 10 : (issue.severity || 0) * 10}%` }}
              />
            </div>
          </div>
        </div>

        {imageAnalysisText && !isRunning && (
          <div className="mt-4 bg-[#0969da]/10 border border-[#0969da]/30 rounded-xl p-4 sm:p-5">
            <span className="text-[11px] font-bold text-[#0969da] uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-4 h-4" /> Visual Analysis
            </span>
            <p className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
              {imageAnalysisText}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Agent3Visuals({ isRunning, issue }: { isRunning: boolean, issue: any }) {
  // Use exact database tracking if available. If still running or missing DB fields, assume true (running state).
  // When done, if the field is explicitly false, we mark it as skipped.
  const skipWeather = !isRunning && issue?.weather_checked === false;
  const skipWebSearch = !isRunning && issue?.web_search_checked === false;

  return (
    <div className="mt-4 bg-black/40 border border-border rounded-xl p-4 sm:p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2 relative z-20">

        {/* Step 1: Weather */}
        <div className={`flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 w-24 ${skipWeather ? 'opacity-50' : 'opacity-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-[#0969da]/20 text-[#0969da] animate-pulse ring-2 ring-[#0969da]/50' : skipWeather ? 'bg-muted/50 text-muted-foreground ring-1 ring-border' : 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : skipWeather ? <MinusCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-[#0969da]' : skipWeather ? 'text-muted-foreground' : 'text-emerald-500'}`}>
              {skipWeather ? 'Weather Call Skipped' : 'Check Open-Meteo'}
            </span>
          </div>
        </div>

        {/* Progress Line 1 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[#0969da] to-transparent' : 'w-full bg-emerald-500'}`} />
        </div>

        {/* Step 2: Web Search */}
        <div className={`flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 w-24 ${skipWebSearch ? 'opacity-50' : 'opacity-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-amber-500/20 text-amber-500 animate-pulse ring-2 ring-amber-500/50' : skipWebSearch ? 'bg-muted/50 text-muted-foreground ring-1 ring-border' : 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : skipWebSearch ? <MinusCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-amber-500' : skipWebSearch ? 'text-muted-foreground' : 'text-emerald-500'}`}>
              {skipWebSearch ? 'Web Search Skipped' : 'Web Search'}
            </span>
          </div>
        </div>

        {/* Progress Line 2 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-amber-500 to-transparent' : 'w-full bg-emerald-500'}`} />
        </div>

        {/* Step 3: Synthesis */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-purple-500/20 text-purple-500 animate-pulse ring-2 ring-purple-500/50' : 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-purple-500' : 'text-emerald-500'}`}>
              Synthesize Score
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

function Agent4Visuals({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="mt-4 bg-black/40 border border-border rounded-xl p-4 sm:p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2 relative z-20">

        {/* Step 1: SOP Search */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 shadow-[0_0_10px_rgba(45,212,191,0.3)] animate-pulse' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50'}`}>
            {isRunning ? <Database className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-teal-400' : 'text-emerald-500'}`}>
              Knowledge Base
            </span>
          </div>
        </div>

        {/* Progress Line 1 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-teal-500 to-transparent' : 'w-full bg-emerald-500'}`} />
        </div>

        {/* Step 2: Brief Drafting */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-[#0969da]/20 text-[#0969da] border-[#0969da]/50 shadow-[0_0_10px_rgba(9,105,218,0.3)] animate-pulse' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50'}`}>
            {isRunning ? <FileText className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-[#0969da]' : 'text-emerald-500'}`}>
              Drafting Brief
            </span>
          </div>
        </div>

        {/* Progress Line 2 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-[#0969da] to-transparent' : 'w-full bg-emerald-500'}`} />
        </div>

        {/* Step 3: SLA */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50'}`}>
            {isRunning ? <Calendar className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-amber-500' : 'text-emerald-500'}`}>
              Determine SLA
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

export function DashboardClient({ user, profile, initialIssues, departments }: Props) {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'resolved'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'infrastructure', etc.
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSettingLocation, setIsSettingLocation] = useState(false)
  const [nearbyReviews, setNearbyReviews] = useState<Issue[]>([])
  const [isFetchingReviews, setIsFetchingReviews] = useState(false)
  const [voteTally, setVoteTally] = useState<{ confirms: number; denies: number } | null>(null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Get user's geolocation once on mount for the map center
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { } // silently fall back to Nashik center in the map component
      )
    }
  }, [])

  // Auto-open issue from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const issueId = params.get('issueId')
      if (issueId && initialIssues.length > 0) {
        const found = initialIssues.find(i => i.id === issueId)
        if (found) {
          setSelectedIssue(found)
          // Clean up URL without reloading
          window.history.replaceState({}, '', '/dashboard')
        }
      }
    }
  }, [initialIssues])

  useEffect(() => {
    if (selectedIssue?.status === 'community_review') {
      const fetchTally = async () => {
        try {
          const supabase = createClient()
          const { data } = await supabase.from('verifications').select('verdict').eq('issue_id', selectedIssue.id)
          if (data) {
            const confirms = data.filter(v => v.verdict).length
            const denies = data.filter(v => !v.verdict).length
            setVoteTally({ confirms, denies })
          }
        } catch (e) { }
      }
      fetchTally()
    } else {
      setVoteTally(null)
    }
  }, [selectedIssue])

  const fetchNearbyReviews = async () => {
    if (!profile?.home_location) return
    setIsFetchingReviews(true)
    try {
      const res = await fetch(`/api/reviews?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setNearbyReviews(data.issues || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetchingReviews(false)
    }
  }

  useEffect(() => {
    fetchNearbyReviews()
  }, [profile?.home_location])

  const handleVote = async (issueId: string, verdict: boolean) => {
    const toastId = toast.loading('Submitting your vote...')
    try {
      const res = await fetch(`/api/reviews/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, verdict, distanceMeters: 0 })
      })
      if (!res.ok) throw new Error('Failed to submit vote')
      toast.success('Vote submitted successfully!', { id: toastId })
      setNearbyReviews(prev => prev.filter(i => i.id !== issueId))
    } catch (error: any) {
      toast.error(error.message, { id: toastId })
    }
  }

  const handleSetHomeLocation = () => {
    setIsSettingLocation(true)
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      setIsSettingLocation(false)
      return
    }

    toast.loading('Finding your location...', { id: 'location-toast' })
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          // Reverse geocode to get city/state
          let address = null
          try {
            const geoRes = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
            if (geoRes.ok) {
              const geoData = await geoRes.json()
              if (geoData.address) {
                address = geoData.address
              }
            }
          } catch (e) {
            console.error('Geocoding failed:', e)
          }

          const res = await fetch('/api/profile/home-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              lat,
              lng,
              address
            }),
          })
          if (!res.ok) throw new Error('Failed to save home location')
          toast.success('Home location saved successfully! Refreshing dashboard...', { id: 'location-toast' })
          setIsProfileOpen(false)
          setTimeout(() => window.location.reload(), 1500)
        } catch (error: any) {
          toast.error(error.message, { id: 'location-toast' })
        } finally {
          setIsSettingLocation(false)
        }
      },
      (error) => {
        toast.error('Unable to retrieve your location', { id: 'location-toast' })
        setIsSettingLocation(false)
      }
    )
  }

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {}
    departments.forEach(d => {
      map[d.id] = d.name
    })
    return map
  }, [departments])

  const handleRetry = async (issueId: string) => {
    setIsRetrying(true)
    toast.loading('Resuming pipeline...', { id: 'retry-toast' })
    try {
      const res = await fetch('/api/reports/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId })
      })
      if (!res.ok) throw new Error('Failed to resume pipeline')
      toast.success('Pipeline resumed successfully', { id: 'retry-toast' })
    } catch (err: any) {
      toast.error(err.message, { id: 'retry-toast' })
    } finally {
      setIsRetrying(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('issues-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            const updatedIssue = payload.new as Issue
            setIssues(prev => {
              const exists = prev.some(i => i.id === updatedIssue.id)
              if (exists) {
                return prev.map(i => (i.id === updatedIssue.id ? updatedIssue : i))
              }
              return [updatedIssue, ...prev]
            })
            // Update selected issue if it's currently open
            setSelectedIssue(prev => (prev?.id === updatedIssue.id ? updatedIssue : prev))

            if (updatedIssue.pipeline_stage === 'failed' || updatedIssue.pipeline_stage?.endsWith('_failed')) {
              toast.error('Pipeline Failed', {
                description: `Error processing "${updatedIssue.title || 'your report'}". Please try again.`,
              })
            } else {
              toast.info('Status Updated', {
                description: `"${updatedIssue.title || 'Your report'}" status is now ${STATUS_DETAILS[updatedIssue.status]?.label || updatedIssue.status}.`,
              })
            }
          }
          if (payload.eventType === 'INSERT') {
            const newIssue = payload.new as Issue
            setIssues(prev => {
              if (prev.some(i => i.id === newIssue.id)) return prev
              return [newIssue, ...prev]
            })

            toast.success('New Issue Registered', {
              description: `"${newIssue.title || 'Your report'}" has been successfully processed by the AI pipeline.`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  // Statistics calculations
  const totalCount = issues.length
  const resolvedCount = issues.filter(i => i.status === 'resolved').length
  const activeCount = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0

  // Filtered & Sorted issues
  const filteredIssues = useMemo(() => {
    return issues
      .filter(issue => {
        // Status matching
        let matchesStatus = true
        if (statusFilter === 'active') {
          matchesStatus = issue.status === 'open' || issue.status === 'in_progress'
        } else if (statusFilter === 'resolved') {
          matchesStatus = issue.status === 'resolved'
        }

        // Category matching
        const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter

        return matchesStatus && matchesCategory
      })
      .sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [issues, statusFilter, categoryFilter])

  // Karma Level Computations
  const karmaScore = profile?.karma_score || 0
  const karmaLvl = getKarmaLevel(karmaScore)
  const karmaProgress = karmaLvl.level === 4
    ? 100
    : Math.min(100, Math.max(0, ((karmaScore - karmaLvl.min) / (karmaLvl.max - karmaLvl.min)) * 100))
  const karmaToNext = karmaLvl.max - karmaScore

  // Helper for severity displays
  const getSeverityLabel = (s: number) => {
    if (s >= 7) return { text: 'High Priority', color: 'text-rose-400 border-rose-900/30 bg-rose-950/20' }
    if (s >= 4) return { text: 'Medium Priority', color: 'text-amber-400 border-amber-900/30 bg-amber-950/20' }
    return { text: 'Low Priority', color: 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20' }
  }

  // Helper for SLA days calculation
  const getSlaDaysRemaining = (deadlineStr: string | null) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-background border-b border-border transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-between items-center h-16">
            {/* Left side empty placeholder to balance flex layout */}
            <div className="flex-1"></div>

            {/* Centered Logo / Title */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
              <span className="text-base font-bold tracking-tight text-foreground block leading-none">
                CivicPulse
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase block mt-1">
                Citizen Portal
              </span>
            </div>

            {/* Right side: User Profile Icon with GitHub-style dropdown */}
            <div className="flex-1 flex justify-end relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 focus:outline-none cursor-pointer"
                type="button"
                aria-label="User menu"
              >
                <Avatar className="w-9 h-9 ring-2 ring-slate-900 shadow-inner hover:ring-4 hover:ring-slate-700/50 hover:shadow-[0_0_12px_rgba(148,163,184,0.25)] hover:scale-105 transition-all duration-200">
                  {(user.user_metadata?.avatar_url || user.user_metadata?.picture) && (
                    <AvatarImage
                      src={user.user_metadata.avatar_url || user.user_metadata.picture}
                      alt={user.user_metadata.full_name || 'User Avatar'}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                    {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>

              {/* Dropdown Card */}
              {isProfileOpen && (
                <>
                  {/* Backdrop overlay to close the dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-md shadow-lg bg-card border border-border z-50 py-1 origin-top-right focus:outline-none">
                    {/* User info header in dropdown (GitHub style) */}
                    <div className="px-4 py-2 border-b border-border text-left">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Citizen'}
                      </p>
                      {(user.user_metadata?.full_name || user.user_metadata?.name) && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>
                    {/* Action: Set Home Location */}
                    {profile?.home_address ? (
                      <div className="px-4 py-2 border-b border-border text-left bg-muted/30">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Home Location</p>
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#0969da]" />
                          {profile.home_address}
                        </p>
                        <button
                          onClick={handleSetHomeLocation}
                          disabled={isSettingLocation}
                          className="text-[10px] text-muted-foreground hover:text-foreground mt-1 underline underline-offset-2 disabled:opacity-50"
                        >
                          {isSettingLocation ? 'Updating...' : 'Update location'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSetHomeLocation}
                        disabled={isSettingLocation}
                        className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-2 font-medium cursor-pointer disabled:opacity-50 border-b border-border"
                      >
                        {isSettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        Set Home Location
                      </button>
                    )}
                    {/* Action: Sign Out */}
                    <form action={signOut} className="w-full">
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT COLUMN: Profile & Action & Stats */}
          <div className="lg:col-span-1 space-y-6">


            {/* Quick Actions (Large Primary Button) */}
            <Button
              onClick={() => router.push('/report')}
              className="w-full bg-[#2da44e] hover:bg-[#2c974b] text-foreground font-semibold text-sm h-12 rounded-xl transition-colors group"
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                Report a New Issue
              </div>
            </Button>

            {/* Mini Map Widget */}
            <MiniMapWidget
              onOpenFullMap={() => { setIsMapOpen(true); setIsLeaderboardOpen(false); setSelectedIssue(null); }}
              userLocation={userLocation}
            />

            {/* Leaderboard Button */}
            <Button
              onClick={() => { setIsLeaderboardOpen(true); setIsMapOpen(false); setSelectedIssue(null); }}
              variant="outline"
              className="w-full border-border bg-card hover:bg-muted hover:border-amber-500/40 text-foreground font-semibold text-sm h-10 rounded-xl transition-all group mt-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                <span className="text-sm font-semibold">Show Leaderboard</span>
              </div>
            </Button>

            {/* Rich Statistics Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase pl-1">
                Dashboard Overview
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Stat Cards */}
                {[
                  {
                    label: 'Total Reports',
                    value: totalCount,
                    icon: CheckSquare,
                    colorClass: 'text-[#0969da] bg-blue-950/20 border-blue-900/30'
                  },
                  {
                    label: 'Active Issues',
                    value: activeCount,
                    icon: Activity,
                    colorClass: 'text-amber-400 bg-amber-950/20 border-amber-900/30'
                  },
                  {
                    label: 'Resolved Issues',
                    value: resolvedCount,
                    icon: CheckCircle2,
                    colorClass: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30'
                  },
                  {
                    label: 'Karma Gained',
                    value: karmaScore,
                    icon: Award,
                    colorClass: 'text-purple-400 bg-purple-950/20 border-purple-900/30'
                  }
                ].map(stat => (
                  <Card key={stat.label} className="bg-card border-border">
                    <CardContent className="p-4 flex flex-col justify-between h-24">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-medium tracking-tight truncate leading-none">
                          {stat.label}
                        </span>
                        <div className={`p-1.5 rounded-lg border ${stat.colorClass.split(' ').slice(1).join(' ')}`}>
                          <stat.icon className={`w-3.5 h-3.5 ${stat.colorClass.split(' ')[0]}`} />
                        </div>
                      </div>
                      <p className="text-xl font-bold text-foreground tracking-tight leading-none mt-2">
                        {stat.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

            </div>

            {/* "Your Community Needs You" Section (Moved to Left Column) */}
            {profile?.home_location && nearbyReviews.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-[0_0_15px_rgba(245,158,11,0.1)] border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold text-foreground">Community Review</h2>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] ml-auto">
                    {nearbyReviews.length} Pending
                  </Badge>
                </div>
                <div className="space-y-4">
                  {nearbyReviews.map(review => (
                    <div key={review.id} className="p-4 rounded-xl bg-background/50 border border-border flex flex-col gap-3">
                      {review.photo_url && (
                        <div className="w-full h-32 rounded-lg overflow-hidden border border-border mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={review.photo_url} alt="Issue" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-sm leading-tight">{review.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{review.description}</p>
                        </div>
                        {review.credibility_score !== null && (
                          <Badge variant="outline" className="bg-background text-[10px] shrink-0">
                            Score: {review.credibility_score}/10
                          </Badge>
                        )}
                      </div>
                      {review.reasoning && (
                        <div className="bg-muted/50 p-2 rounded text-[10px] border border-border">
                          <span className="font-semibold text-muted-foreground mr-1">AI Note:</span>
                          <span className="text-muted-foreground">{review.reasoning}</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Button
                          onClick={() => handleVote(review.id, true)}
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400 border-emerald-500/30 text-[11px] h-8"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm
                        </Button>
                        <Button
                          onClick={() => handleVote(review.id, false)}
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-400 border-rose-500/30 text-[11px] h-8"
                        >
                          <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Search, Filters, and Feed */}
          <div className="lg:col-span-2 space-y-6">

            {/* Feed Controls Header */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    Your Civic Reports
                    <Badge variant="outline" className="bg-background/60 border-border text-muted-foreground text-xs px-2 py-0.5 h-5 font-semibold">
                      {filteredIssues.length}
                    </Badge>
                  </h2>
                </div>
              </div>

              {/* Status Segment Tabs */}
              <div className="w-full">
                {/* Status Segment Control */}
                <div role="tablist" aria-label="Status Filters" className="flex bg-background/60 p-1 rounded-xl border border-border/80 items-center">
                  {[
                    { id: 'all', label: 'All Reports' },
                    { id: 'active', label: 'Active Only' },
                    { id: 'resolved', label: 'Resolved' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={statusFilter === tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`flex-1 text-center text-[10px] font-semibold py-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#0969da] focus-visible:outline-none ${statusFilter === tab.id
                        ? 'bg-card text-[#0969da] border border-slate-850 shadow-sm'
                        : 'text-muted-foreground hover:text-muted-foreground'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Category Filter Pills */}
              <div role="group" aria-label="Category Filters" className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <button
                  aria-pressed={categoryFilter === 'all'}
                  onClick={() => setCategoryFilter('all')}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#0969da] focus-visible:outline-none ${categoryFilter === 'all'
                    ? 'bg-white text-slate-950 border-white font-bold shadow-sm'
                    : 'bg-background/40 text-muted-foreground border-border hover:text-muted-foreground'
                    }`}
                >
                  All Categories
                </button>
                {Object.entries(CATEGORY_DETAILS).map(([key, value]) => {
                  const Icon = value.icon
                  const isActive = categoryFilter === key
                  return (
                    <button
                      key={key}
                      aria-pressed={isActive}
                      onClick={() => setCategoryFilter(key)}
                      className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#0969da] focus-visible:outline-none ${isActive
                        ? 'bg-white text-slate-950 border-white font-bold shadow-sm'
                        : 'bg-background/40 text-muted-foreground border-border hover:text-muted-foreground'
                        }`}
                    >
                      <Icon className="w-3 h-3" />
                      {value.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reports List Feed */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredIssues.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full"
                    key="empty"
                  >
                    <Card className="bg-card border-border border-dashed py-16 text-center">
                      <CardContent className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4">
                          <MapPin className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-semibold text-muted-foreground">No matching reports</h4>
                        <p className="text-[11px] text-muted-foreground max-w-xs mt-1 leading-relaxed">
                          {categoryFilter !== 'all' || statusFilter !== 'all'
                            ? "We couldn't find any reports matching your current filter configuration."
                            : "You haven't submitted any civic issues yet. Report one to help improve your city."}
                        </p>
                        {(categoryFilter !== 'all' || statusFilter !== 'all') ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setCategoryFilter('all')
                              setStatusFilter('all')
                            }}
                            className="mt-4 text-[10px] font-semibold text-[#0969da] hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            Reset Filter Settings
                          </Button>
                        ) : (
                          <Button
                            onClick={() => router.push('/report')}
                            className="mt-4 bg-[#2da44e] hover:bg-blue-500 text-foreground text-[10px] font-semibold h-8 px-4"
                          >
                            Submit First Report
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  filteredIssues.map((issue, idx) => {
                    const cat = CATEGORY_DETAILS[issue.category] || {
                      icon: MapPin,
                      label: issue.category,
                      color: 'text-muted-foreground',
                      bgColor: 'bg-background/40',
                      borderColor: 'border-border/30'
                    }
                    const CatIcon = cat.icon
                    const status = STATUS_DETAILS[issue.status] || {
                      label: issue.status,
                      bgClass: 'bg-card/40',
                      borderClass: 'border-border',
                      textClass: 'text-muted-foreground',
                      dotClass: 'bg-slate-500'
                    }
                    const severity = getSeverityLabel(issue.severity)

                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                        layout
                      >
                        <Card
                          role="button"
                          tabIndex={0}
                          aria-label={`View issue: ${issue.title || 'Untitled'}`}
                          onClick={() => setSelectedIssue(issue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedIssue(issue)
                            }
                          }}
                          className="bg-card border-border hover:bg-muted transition-all duration-200 cursor-pointer relative overflow-hidden group/card focus-visible:ring-2 focus-visible:ring-[#0969da] focus-visible:outline-none"
                        >
                          {/* Left Border Category Accent */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${cat.color.replace('text-', 'bg-')}`} />

                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Category Circle Icon or Uploaded Image */}
                              {issue.photo_url ? (
                                <img
                                  src={issue.photo_url}
                                  alt={issue.title || 'Issue'}
                                  className="w-10 h-10 rounded-xl object-cover border border-border shadow-inner shrink-0"
                                />
                              ) : issue.video_url ? (
                                <div className="w-10 h-10 rounded-xl bg-black border border-border flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative">
                                  <video src={issue.video_url} className="w-full h-full object-cover opacity-70" />
                                </div>
                              ) : (
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${cat.bgColor} ${cat.borderColor}`}>
                                  <CatIcon className={`w-5 h-5 ${cat.color}`} />
                                </div>
                              )}

                              {/* Title, Address, Date */}
                              <div className="min-w-0 flex-1">
                                <h3 className="text-xs font-semibold text-foreground truncate leading-tight group-hover/card:text-[#0969da] transition-colors">
                                  {issue.title || issue.description?.slice(0, 60) + '...'}
                                </h3>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] max-w-[150px] sm:max-w-[220px] truncate">
                                      {issue.address || 'Location recorded'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px]">
                                      {new Date(issue.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Status, Severity & Chevron */}
                            <div className="flex items-center gap-3 shrink-0">

                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/card:text-foreground transition-colors group-hover/card:translate-x-0.5 duration-200" />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
      </main>

      {/* DETAILED DIALOG: AI Pipeline Trace and Report Details */}
      <Dialog open={!!selectedIssue} onOpenChange={open => !open && setSelectedIssue(null)}>
        {selectedIssue && (() => {
          const cat = CATEGORY_DETAILS[selectedIssue.category] || {
            icon: MapPin,
            label: selectedIssue.category,
            color: 'text-muted-foreground',
            bgColor: 'bg-background/40',
            borderColor: 'border-border/30'
          }
          const CatIcon = cat.icon
          const status = STATUS_DETAILS[selectedIssue.status] || {
            label: selectedIssue.status,
            bgClass: 'bg-card/40',
            borderClass: 'border-border',
            textClass: 'text-muted-foreground',
            dotClass: 'bg-slate-500'
          }
          const severity = getSeverityLabel(selectedIssue.severity)
          const slaDays = getSlaDaysRemaining(selectedIssue.sla_deadline)

          return (
            <DialogContent className="bg-background border-border text-foreground w-[95vw] max-w-7xl sm:max-w-7xl overflow-y-auto max-h-[90vh] p-0 rounded-2xl shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              <div className="p-8 sm:p-12">
                {/* Screen Reader Announcement for live updates */}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {`Issue status: ${selectedIssue.status}. Pipeline stage: ${selectedIssue.pipeline_stage ? selectedIssue.pipeline_stage.replace(/_/g, ' ') : 'Not started'}`}
                </div>

                {/* Header Information (Top Row) */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    {/* Icon or Image */}
                    <div className={`w-14 h-14 rounded-2xl border flex shrink-0 items-center justify-center shadow-inner overflow-hidden ${cat.bgColor} ${cat.borderColor}`}>
                      {selectedIssue.photo_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selectedIssue.photo_url} alt="Issue" className="w-full h-full object-cover" />
                        </>
                      ) : selectedIssue.video_url ? (
                        <video src={selectedIssue.video_url} className="w-full h-full object-cover bg-black" />
                      ) : (
                        <CatIcon className={`w-7 h-7 ${cat.color}`} />
                      )}
                    </div>
                    {/* Title & Badges */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-none">
                          {selectedIssue.title || 'Untitled Report'}
                        </DialogTitle>

                        {(() => {
                          const cat = CATEGORY_DETAILS[selectedIssue.category]
                          if (!cat) return null
                          const Icon = cat.icon
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${cat.color} ${cat.bgColor} ${cat.borderColor} w-fit`}>
                              <Icon className="w-3.5 h-3.5" />
                              {cat.label}
                            </div>
                          )
                        })()}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${status.bgClass} ${status.borderClass} ${status.textClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                          {status.label}
                        </span>
                        {selectedIssue.is_emergency && (
                          <span className="bg-rose-950/30 border border-rose-900/30 text-rose-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Emergency
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location (Top Right) */}
                  <div className="flex items-start gap-2 text-foreground text-sm font-medium sm:text-right sm:max-w-[300px] mt-2 sm:mt-0 bg-card/40 p-2.5 rounded-xl border border-border/50">
                    <MapPin className="w-4 h-4 mt-0.5 text-[#0969da] shrink-0 sm:order-2 sm:mt-0.5 sm:ml-2" />
                    <div className="flex flex-col sm:items-end w-full">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Location</p>
                      <span className="leading-snug text-xs text-muted-foreground break-words w-full">{selectedIssue.address || 'Address recorded'}</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-border mb-8" />

                {/* Single Column Layout */}
                <div className="space-y-12">

                  {/* Description */}
                  <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-line font-medium mt-4">
                    {selectedIssue.description}
                  </p>

                  {/* Attached Media */}
                  {(selectedIssue.photo_url || selectedIssue.video_url) && (
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                      {selectedIssue.photo_url && (
                        <div className="rounded-xl overflow-hidden border border-border sm:max-w-[50%]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selectedIssue.photo_url} alt="Attached photo" className="w-full h-auto object-cover max-h-[300px]" />
                        </div>
                      )}
                      {selectedIssue.video_url && (
                        <div className="rounded-xl overflow-hidden border border-border bg-black sm:max-w-[50%] flex items-center justify-center">
                          <video src={selectedIssue.video_url} controls className="w-full h-auto max-h-[300px]" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Routing Details */}
                  <div className="bg-card/50 border border-border rounded-xl p-6 sm:p-8 space-y-6">
                    <h4 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none">
                      <Building className="w-4 h-4 text-muted-foreground" /> Administrative Routing Details
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Assigned Department</span>
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-1">
                          <Building className="w-4 h-4 text-indigo-400" />
                          {selectedIssue.department_id ? (departmentMap[selectedIssue.department_id] || `Department ID: ${selectedIssue.department_id}`) : 'Municipal Processing Queue'}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground font-semibold">SLA Resolution Target</span>
                        {selectedIssue.status === 'resolved' ? (
                          <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Resolved
                          </p>
                        ) : selectedIssue.sla_deadline ? (
                          <div className="mt-1">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-amber-400" />
                              {new Date(selectedIssue.sla_deadline).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                            {slaDays !== null && (
                              <p className={`text-[10px] font-semibold mt-1 ${slaDays < 0 ? 'text-rose-400' : 'text-amber-400'
                                }`}>
                                {slaDays < 0 ? `Overdue by ${Math.abs(slaDays)} days` : slaDays === 0 ? 'Due today' : `${slaDays} days remaining`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-1">Pending SLA Assignment</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Processing Trace (Stepper / Timeline) */}
                  <div className="space-y-6 pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none pl-1">
                      <Cpu className="w-4 h-4 text-muted-foreground" /> AI Agent Pipeline Processing Trace
                    </h4>

                    <div className="relative pl-8 border-l-2 border-border/80 space-y-10 ml-2 mt-6">

                      {/* AGENT 0: TRANSLATOR */}
                      {(() => {
                        const state0 = getAgentState(selectedIssue.pipeline_stage, 'agent0_translation')
                        return (
                          <div className={`relative ${state0 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state0} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Globe className="w-3.5 h-3.5 text-[#0969da]" />
                                  Agent 0: Multilingual Translator
                                </span>
                                <AgentStatusBadge state={state0} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Detects language and provides an English translation for downstream agents.
                              </p>

                              {state0 === 'done' && (
                                <div className="bg-[#0969da]/10 p-4 sm:p-5 rounded-xl border border-[#0969da]/30 mt-4">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Language Detected:</span>
                                      <span className="font-bold text-[#0969da] text-xs uppercase tracking-wider">{selectedIssue.original_language || 'English'}</span>
                                    </div>
                                    {selectedIssue.translation_trace && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        <span className="font-bold text-muted-foreground">Trace:</span> {selectedIssue.translation_trace}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 1: CLASSIFIER */}
                      {(() => {
                        const state1 = getAgentState(selectedIssue.pipeline_stage, 'agent1_classifier')
                        return (
                          <div className={`relative ${state1 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state1} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Cpu className="w-3.5 h-3.5 text-[#0969da]" />
                                  Agent 1: Semantic Classifier
                                </span>
                                <AgentStatusBadge state={state1} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Analyzed raw text/media, classified category, subcategory and mapped initial severity.
                              </p>

                              {(state1 === 'done' || state1 === 'in_progress') && (
                                <Agent1Visuals issue={selectedIssue} isRunning={state1 === 'in_progress'} />
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 2: DEDUPLICATION */}
                      {(() => {
                        const state2 = getAgentState(selectedIssue.pipeline_stage, 'agent2_deduplication')
                        return (
                          <div className={`relative ${state2 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state2} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Database className="w-3.5 h-3.5 text-[#0969da]" />
                                  Agent 2: Vector Deduplicator
                                </span>
                                <AgentStatusBadge state={state2} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Scanned localized pgvector database within a 200-meter radius to prevent duplicate reports.
                              </p>

                              <Agent2MapVisuals key={selectedIssue.id} issue={selectedIssue} allIssues={issues} agentState={state2}>
                                {state2 === 'done' && (
                                  <div className="bg-[#0969da]/10 p-4 sm:p-5 rounded-xl border border-[#0969da]/30 mt-4">
                                    {selectedIssue.cluster_id ? (
                                      <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                          <span className="font-bold text-amber-500 text-xs uppercase tracking-wider">Duplicate Detected</span>
                                        </div>
                                        <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                          <span className="font-bold text-muted-foreground">Trace:</span> This issue has been clustered with an existing report in this vicinity.
                                          <br />
                                          <span className="font-mono text-[11px] mt-2 block text-muted-foreground">
                                            Cluster ID: {selectedIssue.cluster_id.slice(0, 8)}...
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <ShieldCheck className="w-3.5 h-3.5 text-[#0969da]" />
                                          <span className="font-bold text-[#0969da] text-xs uppercase tracking-wider">Unique Report</span>
                                        </div>
                                        <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                          <span className="font-bold text-muted-foreground">Trace:</span> Checked unique report. No duplicate entries detected within range.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Agent2MapVisuals>
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 3: VALIDATION */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        const state3 = getAgentState(selectedIssue.pipeline_stage, 'agent3_validation', isDuplicate)
                        return (
                          <div className={`relative ${state3 === 'pending' || state3 === 'skipped' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state3} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#0969da]" />
                                  Agent 3: Credibility Validator
                                </span>
                                <AgentStatusBadge state={state3} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Verified credibility index against historical data, user profile reliability, and weather datasets.
                              </p>

                              {(state3 === 'done' || state3 === 'in_progress') && (
                                <Agent3Visuals isRunning={state3 === 'in_progress'} issue={selectedIssue} />
                              )}

                              {state3 === 'done' && (
                                <div className="bg-[#0969da]/10 p-4 sm:p-5 rounded-xl border border-[#0969da]/30 mt-4">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Credibility Index:</span>
                                        <span className={`font-bold text-xs uppercase tracking-wider ${selectedIssue.credibility_score && selectedIssue.credibility_score >= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                          {selectedIssue.credibility_score ? `${(selectedIssue.credibility_score * 10).toFixed(0)}%` : 'Processing...'}
                                        </span>
                                      </div>
                                      <div className="hidden sm:block text-muted-foreground/30">|</div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Validation:</span>
                                        {selectedIssue.needs_community_verification === false ? (
                                          <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider">Approved (by AI)</span>
                                        ) : selectedIssue.needs_community_verification === true ? (
                                          getAgentState(selectedIssue.pipeline_stage, 'awaiting_community_review', isDuplicate) === 'done' ? (
                                            <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider">Community Review Completed</span>
                                          ) : (
                                            <span className="font-bold text-amber-400 text-xs uppercase tracking-wider">Community Review Required</span>
                                          )
                                        ) : (
                                          <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">Pending</span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {selectedIssue.status === 'community_review' && voteTally && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        <span className="font-bold text-muted-foreground">Community Tally:</span>{' '}
                                        <span className="text-emerald-400 font-semibold">{voteTally.confirms} Confirms</span>{' '}
                                        <span className="text-muted-foreground mx-1">/</span>{' '}
                                        <span className="text-rose-400 font-semibold">{voteTally.denies} Denies</span>
                                      </div>
                                    )}

                                    {selectedIssue.reasoning && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        <span className="font-bold text-muted-foreground">Trace:</span> {selectedIssue.reasoning}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 4: RESOLUTION PLANNING */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        const state4 = getAgentState(selectedIssue.pipeline_stage, 'agent4_resolution', isDuplicate)
                        return (
                          <div className={`relative ${state4 === 'pending' || state4 === 'skipped' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state4} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Sparkles className="w-3.5 h-3.5 text-[#0969da]" />
                                  Agent 4: Resolution Routing & SLA Planner
                                </span>
                                <AgentStatusBadge state={state4} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Generated a concise civic action brief for department staff and computed completion SLA.
                              </p>

                              {(state4 === 'done' || state4 === 'in_progress') && (
                                <Agent4Visuals isRunning={state4 === 'in_progress'} />
                              )}

                              {state4 === 'done' && (
                                <div className="mt-2">
                                  {selectedIssue.civic_brief ? (
                                    <div className="bg-card/50 border border-border rounded-xl p-5 shadow-inner mt-4 relative overflow-hidden">
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50" />
                                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                                        <FileText className="w-4 h-4 text-emerald-500" /> Generated Civic Brief (Officer view)
                                      </span>
                                      <p className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        &ldquo;{selectedIssue.civic_brief}&rdquo;
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground italic">SLA generated, awaiting brief indexing.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 5: PREDICTIVE ANALYTICS */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        let state5: PipelineState = 'pending'
                        if (isDuplicate) state5 = 'skipped'
                        else if (selectedIssue.agent5_completed) state5 = 'done'

                        return (
                          <div className={`relative ${state5 === 'pending' || state5 === 'skipped' ? 'opacity-40' : ''}`}>
                            <div className={`absolute -left-[33px] top-0.5 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md ${state5 === 'done' ? 'bg-[#2da44e] shadow-emerald-500/30' : state5 === 'skipped' ? 'bg-slate-600 shadow-slate-500/30' : 'bg-slate-800 opacity-40'}`} />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 leading-none">
                                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                                  Agent 5: Predictive Analytics Agent
                                </span>
                                {state5 === 'skipped' ? (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-500/10 px-1.5 py-0.2 rounded border border-slate-500/20 uppercase tracking-wide leading-none">SKIPPED</span>
                                ) : state5 === 'done' ? (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-muted-foreground bg-card px-1.5 py-0.2 rounded border border-border uppercase tracking-wide leading-none">PENDING</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Runs asynchronously to analyze ward-level trends and predict seasonal civic issues.
                              </p>
                            </div>
                          </div>
                        )
                      })()}

                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-8 mt-4 border-t border-border">
                  {selectedIssue.status === 'resolved' && (
                    <Button
                      onClick={() => window.open(`/receipt/${selectedIssue.id}`, '_blank')}
                      className="w-full sm:w-auto bg-[#2da44e] hover:bg-[#2c974b] text-foreground text-xs h-10 px-6 rounded-xl flex items-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Impact Receipt
                    </Button>
                  )}
                  <Button
                    onClick={() => setSelectedIssue(null)}
                    className="w-full sm:w-auto bg-card border border-border hover:bg-muted text-foreground text-xs h-10 px-6 rounded-xl"
                  >
                    Close Details
                  </Button>
                </div>

              </div>
            </DialogContent>
          )
        })()}
      </Dialog>

      {/* City-Wide Issue Map Panel */}
      <IssueMapPanel
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        userLocation={userLocation}
      />

      {/* Citizen Leaderboard Panel */}
      <CitizenLeaderboardPanel
        userId={user.id}
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  )
}
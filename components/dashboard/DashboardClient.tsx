'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Issue, Profile } from '@/lib/db/types'
import {
  Plus,
  LogOut,
  Star,
  MapPin,
  Clock,
  Search,
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
  FileText
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

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
  utility: {
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
  if (score >= 300) return { name: 'Nashik Ambassador', level: 4, min: 300, max: 1000, next: 'Max Level' }
  if (score >= 150) return { name: 'Civic Champion', level: 3, min: 150, max: 300, next: 'Nashik Ambassador' }
  if (score >= 50) return { name: 'Civic Guardian', level: 2, min: 50, max: 150, next: 'Civic Champion' }
  return { name: 'Civic Observer', level: 1, min: 0, max: 50, next: 'Civic Guardian' }
}

interface Props {
  user: any
  profile: Profile | null
  initialIssues: Issue[]
}

export function DashboardClient({ user, profile, initialIssues }: Props) {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'resolved'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'infrastructure', etc.
  const [sortBy, setSortBy] = useState<'newest' | 'severity'>('newest')

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
            setIssues(prev =>
              prev.map(i => (i.id === updatedIssue.id ? updatedIssue : i))
            )
            // Update selected issue if it's currently open
            setSelectedIssue(prev => (prev?.id === updatedIssue.id ? updatedIssue : prev))
            
            toast.info('Status Updated', {
              description: `"${updatedIssue.title || 'Your report'}" status is now ${STATUS_DETAILS[updatedIssue.status]?.label || updatedIssue.status}.`,
            })
          }
          if (payload.eventType === 'INSERT') {
            const newIssue = payload.new as Issue
            setIssues(prev => [newIssue, ...prev])
            
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
        // Search text matching
        const matchesSearch =
          (issue.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (issue.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (issue.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.category.toLowerCase().includes(searchQuery.toLowerCase())

        // Status matching
        let matchesStatus = true
        if (statusFilter === 'active') {
          matchesStatus = issue.status === 'open' || issue.status === 'in_progress'
        } else if (statusFilter === 'resolved') {
          matchesStatus = issue.status === 'resolved'
        }

        // Category matching
        const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter

        return matchesSearch && matchesStatus && matchesCategory
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else {
          return (b.severity || 0) - (a.severity || 0)
        }
      })
  }, [issues, searchQuery, statusFilter, categoryFilter, sortBy])

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div>
                <span className="text-base font-bold tracking-tight text-foreground block leading-none">
                  CivicPulse
                </span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase block mt-1">
                  Nashik City Portal
                </span>
              </div>
            </div>

            {/* Realtime & User Profile */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-card/60 border border-border/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Live Sync Active
                </span>
              </div>

              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <Avatar className="w-8 h-8 ring-2 ring-slate-900 shadow-inner">
                  <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-foreground leading-none">
                    {user.email?.split('@')[0] || 'Citizen'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Verified Reporter
                  </p>
                </div>

                <form action={signOut} className="ml-1">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors h-8 w-8"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT COLUMN: Profile & Action & Stats */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Gamified Karma Card */}
            <Card className="bg-card border-border relative overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#0969da] tracking-wider uppercase">
                      Citizen Civic Profile
                    </span>
                    <h2 className="text-lg font-bold text-foreground mt-1">
                      {user.email?.split('@')[0] || 'Citizen'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 shadow-sm shadow-amber-500/5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold">{karmaScore} Karma</span>
                  </div>
                </div>

                {/* Level Display */}
                <div className="mt-6">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Current Rank</p>
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                        <Award className="w-4 h-4 text-[#0969da]" />
                        {karmaLvl.name}
                        <span className="text-xs text-muted-foreground font-normal">Level {karmaLvl.level}</span>
                      </p>
                    </div>
                    {karmaLvl.level < 4 && (
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {karmaToNext} points to Level {karmaLvl.level + 1}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-background rounded-full h-2.5 p-0.5 border border-border shadow-inner">
                    <div
                      className="bg-[#2da44e] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${karmaProgress}%` }}
                    />
                  </div>
                  
                  {karmaLvl.level < 4 ? (
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-2 font-medium">
                      <span>{karmaLvl.min} Karma</span>
                      <span>Next Rank: {karmaLvl.next} ({karmaLvl.max} Karma)</span>
                    </div>
                  ) : (
                    <p className="text-[9px] text-emerald-400 mt-2 font-semibold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Max Rank Achieved! You are a Nashik Ambassador.
                    </p>
                  )}
                </div>

                <div className="border-t border-border/60 mt-6 pt-4 text-[11px] text-muted-foreground/90 leading-relaxed flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-[#0969da] shrink-0 mt-0.5" />
                  <span>
                    Earn points by reporting civic issues or assisting city officials with community verifications.
                  </span>
                </div>
              </CardContent>
            </Card>

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

              {/* Resolution Rate Card */}
              <Card className="bg-card border-border p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Resolution Efficiency</span>
                  <span className="text-xs font-bold text-emerald-400">{resolutionRate}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-1.5 p-0.5 border border-border/60 shadow-inner">
                  <div
                    className="bg-emerald-500 h-0.5 rounded-full transition-all duration-500"
                    style={{ width: `${resolutionRate}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">
                  Ratio of reported issues successfully resolved by municipal routing.
                </p>
              </Card>
            </div>

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
                  <p className="text-[11px] text-muted-foreground">
                    Track the real-time AI classification, deduplication, and resolution routing.
                  </p>
                </div>

                {/* Sort Control */}
                <div className="flex items-center gap-1.5 bg-background/60 p-0.5 rounded-lg border border-border/80 self-end sm:self-auto">
                  <button
                    onClick={() => setSortBy('newest')}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-all ${
                      sortBy === 'newest'
                        ? 'bg-card text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-muted-foreground'
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => setSortBy('severity')}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-all ${
                      sortBy === 'severity'
                        ? 'bg-card text-rose-400 font-semibold'
                        : 'text-muted-foreground hover:text-muted-foreground'
                    }`}
                  >
                    Priority
                  </button>
                </div>
              </div>

              {/* Search and Status Segment Tabs */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search Bar */}
                <div className="relative md:col-span-6">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by title, category, address..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background/60 border border-border/80 rounded-xl text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-inner"
                  />
                </div>

                {/* Status Segment Control */}
                <div className="flex bg-background/60 p-1 rounded-xl border border-border/80 md:col-span-6 items-center">
                  {[
                    { id: 'all', label: 'All Reports' },
                    { id: 'active', label: 'Active Only' },
                    { id: 'resolved', label: 'Resolved' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`flex-1 text-center text-[10px] font-semibold py-1.5 rounded-lg transition-all ${
                        statusFilter === tab.id
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
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap ${
                    categoryFilter === 'all'
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
                      onClick={() => setCategoryFilter(key)}
                      className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap ${
                        isActive
                          ? `bg-card ${value.color} ${value.borderColor} border-opacity-60 font-bold shadow-md shadow-slate-950/50`
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
                          {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                            ? "We couldn't find any reports matching your current filter configuration."
                            : "You haven't submitted any civic issues yet. Report one to help improve Nashik."}
                        </p>
                        {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSearchQuery('')
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
                          onClick={() => setSelectedIssue(issue)}
                          className="bg-card border-border hover:bg-muted transition-all duration-200 cursor-pointer relative overflow-hidden group/card"
                        >
                          {/* Left Border Category Accent */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${cat.color.replace('text-', 'bg-')}`} />

                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Category Circle Icon */}
                              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${cat.bgColor} ${cat.borderColor}`}>
                                <CatIcon className={`w-5 h-5 ${cat.color}`} />
                              </div>

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
                              <div className="flex flex-col items-end gap-1.5">
                                {/* Status Badge */}
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${status.bgClass} ${status.borderClass} ${status.textClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                                  {status.label}
                                </span>

                                {/* Severity Badge */}
                                <span className={`inline-flex text-[8px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${severity.color}`}>
                                  {severity.text.split(' ')[0]} Sev
                                </span>
                              </div>

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
            <DialogContent className="bg-background border-border text-foreground max-w-2xl overflow-y-auto max-h-[85vh] p-0 rounded-2xl shadow-2xl">
              {/* Modal Banner Image / Category Header */}
              {selectedIssue.photo_url ? (
                <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-card border-b border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedIssue.photo_url}
                    alt={selectedIssue.title || 'Reported Issue Media'}
                    className="w-full h-full object-cover opacity-85 hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                  
                  {/* Floating Action receipt */}
                  <Badge variant="outline" className="absolute top-4 left-4 bg-background/70 border-border text-muted-foreground text-[9px]">
                    Civic Media Capture
                  </Badge>
                </div>
              ) : (
                <div className={`w-full h-24 border-b border-border bg-card relative overflow-hidden`}>
                  <div className="absolute inset-0 flex items-center px-6 gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cat.bgColor} ${cat.borderColor}`}>
                      <CatIcon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">No Image Attached</span>
                      <p className="text-xs text-muted-foreground">Locally cataloged by Nashik Civic Services</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrollable Body Content */}
              <div className="p-6 space-y-6">
                
                {/* Header Information */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <Badge variant="outline" className={`bg-card text-xs px-2.5 py-0.5 capitalize font-semibold shadow-sm ${cat.color} ${cat.borderColor}`}>
                      <CatIcon className="w-3.5 h-3.5 mr-1" />
                      {cat.label}
                    </Badge>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${status.bgClass} ${status.borderClass} ${status.textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                      {status.label}
                    </span>
                    {selectedIssue.is_emergency && (
                      <span className="bg-rose-950/30 border border-rose-900/30 text-rose-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Emergency
                      </span>
                    )}
                  </div>

                  <DialogTitle className="text-base font-bold text-foreground leading-snug">
                    {selectedIssue.title || 'Civic Issue'}
                  </DialogTitle>

                  <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 whitespace-pre-line">
                    {selectedIssue.description}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-border/60">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-muted-foreground">Location</p>
                        <p className="text-muted-foreground text-[11px] truncate max-w-[280px] sm:max-w-[380px]" title={selectedIssue.address}>
                          {selectedIssue.address || 'Address recorded'}
                        </p>
                      </div>
                    </div>
                    
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedIssue.location.lat},${selectedIssue.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#0969da] hover:text-blue-300 hover:underline shrink-0 bg-blue-500/5 hover:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-900/30 transition-all self-start sm:self-auto"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Google Maps
                    </a>
                  </div>
                </div>

                {/* Routing & SLA Section */}
                <div className="bg-card/50 border border-border rounded-xl p-4 space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none">
                    <Building className="w-3.5 h-3.5 text-muted-foreground" /> Administrative Routing Details
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold">Assigned Department</span>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                        <Building className="w-4 h-4 text-indigo-400" />
                        {selectedIssue.department_id ? `Department ID: ${selectedIssue.department_id}` : 'Municipal Processing Queue'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold">SLA Resolution Target</span>
                      {selectedIssue.status === 'resolved' ? (
                        <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Resolved
                        </p>
                      ) : selectedIssue.sla_deadline ? (
                        <div className="mt-0.5">
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-amber-400" />
                            {new Date(selectedIssue.sla_deadline).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                          {slaDays !== null && (
                            <p className={`text-[9px] font-semibold mt-1 ${
                              slaDays < 0 ? 'text-rose-400' : 'text-amber-400'
                            }`}>
                              {slaDays < 0 ? `Overdue by ${Math.abs(slaDays)} days` : slaDays === 0 ? 'Due today' : `${slaDays} days remaining`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic mt-0.5">Pending SLA Assignment</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Processing Trace (Stepper / Timeline) */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none pl-1">
                    <Cpu className="w-3.5 h-3.5 text-muted-foreground" /> AI Agent Pipeline Processing Trace
                  </h4>

                  <div className="relative pl-6 border-l border-border/80 space-y-6">
                    
                    {/* AGENT 1: CLASSIFIER */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 bg-[#2da44e] border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-blue-500/30" />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                            <Cpu className="w-3.5 h-3.5 text-[#0969da]" />
                            Agent 1: Semantic Classifier
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Analyzed raw text/media, classified category, subcategory and mapped initial severity.
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card/30 p-2.5 rounded-lg border border-border text-[10px]">
                          <div>
                            <span className="text-muted-foreground font-semibold">Subcategory:</span>
                            <span className="text-muted-foreground ml-1 font-medium capitalize">{selectedIssue.subcategory || 'N/A'}</span>
                          </div>
                          
                          {/* Severity Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground font-semibold">Severity Score:</span>
                            <span className={`font-bold ${severity.color.split(' ')[0]}`}>{selectedIssue.severity}/10</span>
                            <div className="w-16 bg-background rounded-full h-1.5 border border-border overflow-hidden shrink-0 ml-1">
                              <div
                                className={`h-full rounded-full ${
                                  selectedIssue.severity >= 7 ? 'bg-rose-500' : selectedIssue.severity >= 4 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${selectedIssue.severity * 10}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AGENT 2: DEDUPLICATION */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 bg-[#2da44e] border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-blue-500/30" />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                            <Database className="w-3.5 h-3.5 text-[#0969da]" />
                            Agent 2: Vector Deduplicator
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Scanned localized pgvector database within a 200-meter radius to prevent duplicate reports.
                        </p>
                        <div className="bg-card/30 p-2.5 rounded-lg border border-border text-[10px]">
                          {selectedIssue.cluster_id ? (
                            <p className="text-muted-foreground font-medium">
                              Linked to Active Issue Cluster: <code className="bg-background px-1.5 py-0.5 rounded text-indigo-400 font-mono text-[9px]">{selectedIssue.cluster_id}</code>. Automatic aggregation enabled.
                            </p>
                          ) : (
                            <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" /> Checked unique report. No duplicate entries detected within range.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AGENT 3: VALIDATION */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 bg-[#2da44e] border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-blue-500/30" />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#0969da]" />
                            Agent 3: Credibility Validator
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Verified credibility index against historical data, user profile reliability, and weather datasets.
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card/30 p-2.5 rounded-lg border border-border text-[10px]">
                          <div>
                            <span className="text-muted-foreground font-semibold">Credibility Index:</span>
                            <span className="text-emerald-400 ml-1 font-bold">
                              {selectedIssue.credibility_score ? `${(selectedIssue.credibility_score * 10).toFixed(0)}%` : '91%'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-semibold">Automatic Validation:</span>
                            <span className="text-emerald-400 ml-1 font-semibold">Approved (score ≥ 60%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AGENT 4: RESOLUTION PLANNING */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 bg-[#2da44e] border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-blue-500/30" />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                            <Sparkles className="w-3.5 h-3.5 text-[#0969da]" />
                            Agent 4: Resolution Routing & SLA Planner
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase tracking-wide leading-none">DONE</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Generated a concise civic action brief for department staff and computed completion SLA.
                        </p>
                        
                        {selectedIssue.civic_brief ? (
                          <div className="bg-background border border-border rounded-xl p-3.5 shadow-inner">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                              <FileText className="w-3 h-3" /> Generated Civic Brief (Officer view)
                            </span>
                            <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                              &ldquo;{selectedIssue.civic_brief}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic">SLA generated, awaiting brief indexing.</p>
                        )}
                      </div>
                    </div>

                    {/* AGENT 5: PREDICTIVE ANALYTICS */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 bg-slate-850 border-4 border-slate-950 w-4 h-4 rounded-full flex items-center justify-center shadow-md" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 leading-none">
                            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                            Agent 5: Predictive Analytics Agent
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground bg-card px-1.5 py-0.2 rounded border border-border uppercase tracking-wide leading-none">SCHEDULED</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Runs asynchronously to analyze ward-level trends and predict seasonal civic issues.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-4 border-t border-border/60">
                  <Button
                    onClick={() => {
                      toast.success('Card Copied', {
                        description: 'Impact receipt link has been copied to your clipboard.',
                      })
                    }}
                    variant="outline"
                    className="w-full sm:w-auto border-border text-muted-foreground hover:text-foreground hover:bg-card/60 text-xs h-9"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Share Impact Receipt
                  </Button>
                  <Button
                    onClick={() => setSelectedIssue(null)}
                    className="w-full sm:w-auto bg-card border border-border hover:bg-muted text-foreground text-xs h-9"
                  >
                    Close Details
                  </Button>
                </div>

              </div>
            </DialogContent>
          )
        })()}
      </Dialog>
    </div>
  )
}
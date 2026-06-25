'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Issue, Profile } from '@/lib/db/types'
import { Plus, LogOut, Star, MapPin, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  resolved: 'bg-green-500',
  false_closure: 'bg-red-500',
  closed: 'bg-slate-500',
}

const SEVERITY_LABEL = (s: number) =>
  s >= 7 ? 'High' : s >= 4 ? 'Medium' : 'Low'

const SEVERITY_COLOR = (s: number) =>
  s >= 7 ? 'text-red-400' : s >= 4 ? 'text-yellow-400' : 'text-green-400'

interface Props {
  user: any
  profile: Profile | null
  initialIssues: Issue[]
}

export function DashboardClient({ user, profile, initialIssues }: Props) {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>(initialIssues)

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
            setIssues(prev =>
              prev.map(i =>
                i.id === (payload.new as Issue).id ? (payload.new as Issue) : i
              )
            )
          }
          if (payload.eventType === 'INSERT') {
            setIssues(prev => [payload.new as Issue, ...prev])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  const resolvedCount = issues.filter(i => i.status === 'resolved').length
  const openCount = issues.filter(i => i.status === 'open').length

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-2xl mx-auto p-4">

        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-6">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-blue-600 text-white">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-medium text-sm">
                {user.email?.split('@')[0] || 'Citizen'}
              </p>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400 text-xs font-medium">
                  {profile?.karma_score || 0} Karma
                </span>
              </div>
            </div>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Reported', value: issues.length, color: 'text-blue-400' },
            { label: 'Open', value: openCount, color: 'text-yellow-400' },
            { label: 'Resolved', value: resolvedCount, color: 'text-green-400' },
          ].map(stat => (
            <Card key={stat.label} className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 pb-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-slate-400 text-xs mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Report Button */}
        <Button
          onClick={() => router.push('/report')}
          className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Report a New Issue
        </Button>

        {/* Issues List */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold">Your Reports</h2>

          {issues.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="py-12 text-center">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No reports yet</p>
                <p className="text-slate-600 text-sm mt-1">
                  Tap the button above to report your first issue
                </p>
              </CardContent>
            </Card>
          ) : (
            issues.map((issue, i) => (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {issue.title || issue.description?.slice(0, 60) + '...'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <p className="text-slate-500 text-xs truncate">
                            {issue.address || 'Location recorded'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <p className="text-slate-600 text-xs">
                            {new Date(issue.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short'
                            })}
                          </p>
                          {issue.severity && (
                            <span className={`text-xs font-medium ${SEVERITY_COLOR(issue.severity)}`}>
                              {SEVERITY_LABEL(issue.severity)} Priority
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge className={`${STATUS_COLORS[issue.status]} text-white text-xs capitalize`}>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                        {issue.category && (
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs capitalize">
                            {issue.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
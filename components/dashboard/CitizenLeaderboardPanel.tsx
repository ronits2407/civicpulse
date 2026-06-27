'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Award, Trophy, Medal, Star, ArrowUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface LeaderboardUser {
  id: string
  name: string
  picture: string | null
  karma_score: number
  role: string
}

interface CurrentUserStats {
  rank: number
  karma_score: number
}

function getKarmaLevel(score: number) {
  if (score >= 300) return { name: 'Civic Ambassador', level: 4, min: 300, max: 1000, next: 'Max Level', color: 'text-purple-400 border-purple-900/30 bg-purple-950/20' }
  if (score >= 150) return { name: 'Civic Champion', level: 3, min: 150, max: 300, next: 'Civic Ambassador', color: 'text-blue-400 border-blue-900/30 bg-blue-950/20' }
  if (score >= 50) return { name: 'Civic Guardian', level: 2, min: 50, max: 150, next: 'Civic Champion', color: 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20' }
  return { name: 'Civic Observer', level: 1, min: 0, max: 50, next: 'Civic Guardian', color: 'text-slate-400 border-slate-700 bg-slate-800' }
}

export function CitizenLeaderboardPanel({ userId, isOpen, onClose }: { userId: string, isOpen: boolean, onClose: () => void }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [currentUserStats, setCurrentUserStats] = useState<CurrentUserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/leaderboard?userId=${userId}`)
        if (!res.ok) throw new Error('Failed to fetch leaderboard')
        const data = await res.json()
        setLeaderboard(data.leaderboard)
        setCurrentUserStats(data.currentUserStats)
      } catch (error: any) {
        toast.error('Failed to load leaderboard', { description: error.message })
      } finally {
        setIsLoading(false)
      }
    }
    fetchLeaderboard()
  }, [userId, isOpen])

  const currentUserLevel = currentUserStats ? getKarmaLevel(currentUserStats.karma_score) : getKarmaLevel(0)
  const karmaProgress = currentUserLevel.level === 4
    ? 100
    : Math.min(100, Math.max(0, (((currentUserStats?.karma_score || 0) - currentUserLevel.min) / (currentUserLevel.max - currentUserLevel.min)) * 100))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-background border-border text-foreground w-[95vw] max-w-2xl sm:max-w-2xl p-0 rounded-2xl shadow-2xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {isLoading ? (
          <Card className="bg-card border-0 overflow-hidden h-[600px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#0969da]" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Leaderboard...</p>
            </div>
          </Card>
        ) : (
          <Card className="bg-card border-0 overflow-hidden h-[80vh] min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-foreground tracking-tight">Citizen Leaderboard</h2>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs font-semibold px-2 py-0.5">
                Top 10 Citizens
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background/50 rounded-xl border border-dashed border-border">
                  <Award className="w-8 h-8 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">No Users Yet</h3>
                  <p className="text-xs text-muted-foreground mt-1">There are no citizens on the leaderboard yet. Be the first to earn some karma!</p>
                </div>
              ) : (
                leaderboard.map((user, index) => {
                  const level = getKarmaLevel(user.karma_score)
                  const isCurrentUser = user.id === userId
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      key={user.id}
                      className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${isCurrentUser ? 'bg-blue-950/20 border-blue-900/50 shadow-[0_0_10px_rgba(9,105,218,0.1)]' : 'bg-background/50 border-border hover:bg-muted/50'}`}
                    >
                      <div className="flex-shrink-0 w-8 text-center font-bold text-lg">
                        {index === 0 ? <Medal className="w-6 h-6 text-yellow-400 mx-auto" /> :
                         index === 1 ? <Medal className="w-6 h-6 text-slate-300 mx-auto" /> :
                         index === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto" /> :
                         <span className="text-muted-foreground">#{index + 1}</span>}
                      </div>

                      <Avatar className="w-10 h-10 border border-border">
                        {user.picture && <AvatarImage src={user.picture} alt={user.name} referrerPolicy="no-referrer" />}
                        <AvatarFallback className="bg-muted text-xs font-semibold">{user.name[0].toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-[#0969da]' : 'text-foreground'}`}>
                            {user.name} {isCurrentUser && '(You)'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${level.color}`}>
                            {level.name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground flex items-center justify-end gap-1">
                          {user.karma_score} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Karma</p>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>

            {currentUserStats && (
              <div className="p-4 border-t border-border bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Standing</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-xl flex flex-col items-center justify-center border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Rank</span>
                    <span className="text-lg font-black text-foreground">#{currentUserStats.rank}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {currentUserLevel.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {currentUserStats.karma_score} / {currentUserLevel.max} Karma
                        </p>
                      </div>
                      {currentUserLevel.level < 4 && (
                        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <ArrowUp className="w-3 h-3 text-[#0969da]" />
                          {currentUserLevel.max - currentUserStats.karma_score} to {currentUserLevel.next}
                        </p>
                      )}
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden border border-border">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${karmaProgress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full bg-gradient-to-r ${currentUserLevel.level === 4 ? 'from-purple-500 to-purple-400' : 'from-[#0969da] to-blue-400'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}

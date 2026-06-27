import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Use service role key to access auth.users
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Fetch top 10 citizens by karma (exclude admins)
    const { data: topProfiles, error: topError } = await supabase
      .from('profiles')
      .select('id, karma_score, role')
      .neq('role', 'admin')
      .order('karma_score', { ascending: false })
      .limit(10)

    if (topError) throw topError

    // Fetch user details for top profiles
    const leaderboard = await Promise.all(
      topProfiles.map(async (p) => {
        const { data: { user } } = await supabase.auth.admin.getUserById(p.id)
        
        const name = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Citizen'
        const picture = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
        return {
          id: p.id,
          name,
          picture,
          karma_score: p.karma_score || 0,
          role: p.role
        }
      })
    )

    // Fetch current user's karma score
    const { data: currentUserProfile, error: currentError } = await supabase
      .from('profiles')
      .select('karma_score')
      .eq('id', userId)
      .single()

    if (currentError) throw currentError

    const currentUserKarma = currentUserProfile.karma_score || 0

    // Calculate current user's rank (number of CITIZENS with strictly more karma + 1)
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'admin')
      .gt('karma_score', currentUserKarma)

    if (countError) throw countError

    const currentUserRank = (count || 0) + 1

    return NextResponse.json({
      leaderboard,
      currentUserStats: {
        rank: currentUserRank,
        karma_score: currentUserKarma
      }
    })
  } catch (error: any) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

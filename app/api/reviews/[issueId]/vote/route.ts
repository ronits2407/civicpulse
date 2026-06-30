import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params
    const body = await req.json()
    const { userId, verdict, comment, distanceMeters } = body

    if (!userId || typeof verdict !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Insert verification record
    const { error: insertError } = await supabase.from('verifications').insert({
      issue_id: issueId,
      user_id: userId,
      verdict: verdict,
      comment: comment || null,
      distance_meters: distanceMeters || null,
    })

    if (insertError) throw insertError

    // 2. Add karma for participating (+2)
    await supabase.from('karma_events').insert({
      user_id: userId,
      event_type: 'community_review_participation',
      points: 2,
      issue_id: issueId,
    })

    // 3. Fetch all votes to check quorum
    const { data: verifications, error: fetchError } = await supabase
      .from('verifications')
      .select('verdict, user_id')
      .eq('issue_id', issueId)

    if (fetchError) throw fetchError

    let confirms = 0
    let denies = 0
    verifications.forEach(v => {
      if (v.verdict) confirms++
      else denies++
    })

    // Check quorum rules
    const totalVotes = confirms + denies
    let finalOutcome: 'confirmed' | 'rejected' | 'pending' = 'pending'

    if (totalVotes >= 3) {
      if (confirms >= 3 && confirms >= denies) {
        finalOutcome = 'confirmed'
      } else if (denies >= 3 && denies > confirms) {
        finalOutcome = 'rejected'
      }
    }

    // 4. Handle final outcome if quorum reached
    if (finalOutcome !== 'pending') {
      // Get the original issue to find the reporter
      const { data: issue } = await supabase
        .from('issues')
        .select('user_id')
        .eq('id', issueId)
        .single()
        
      const reporterId = issue?.user_id

      if (finalOutcome === 'confirmed') {
        // Update issue: resume pipeline
        await supabase.from('issues').update({
          status: 'open',
          pipeline_stage: 'agent4_resolution',
          review_confirmed_at: new Date().toISOString(),
        }).eq('id', issueId)

        // Award reporter +20 karma
        if (reporterId) {
          await supabase.from('karma_events').insert({
            user_id: reporterId,
            event_type: 'issue_community_confirmed',
            points: 20,
            issue_id: issueId,
          })
        }

        // Award majority voters +5 bonus
        const majorityVoters = verifications.filter(v => v.verdict === true).map(v => v.user_id)
        for (const vId of majorityVoters) {
          await supabase.from('karma_events').insert({
            user_id: vId,
            event_type: 'community_review_majority_bonus',
            points: 5,
            issue_id: issueId,
          })
        }

        // Trigger Agent 4 manually by calling the pipeline resume endpoint (background)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/reports/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId })
        }).catch(err => console.error('Failed to resume pipeline:', err))

      } else if (finalOutcome === 'rejected') {
        // Update issue: dismiss
        await supabase.from('issues').update({
          status: 'closed',
          pipeline_stage: 'review_rejected',
          review_confirmed_at: new Date().toISOString(),
        }).eq('id', issueId)

        // Penalize reporter -5 karma
        if (reporterId) {
          await supabase.from('karma_events').insert({
            user_id: reporterId,
            event_type: 'issue_community_rejected',
            points: -5,
            issue_id: issueId,
          })
        }

        // Award majority voters +5 bonus
        const majorityVoters = verifications.filter(v => v.verdict === false).map(v => v.user_id)
        for (const vId of majorityVoters) {
          await supabase.from('karma_events').insert({
            user_id: vId,
            event_type: 'community_review_majority_bonus',
            points: 5,
            issue_id: issueId,
          })
        }
      }
    }

    return NextResponse.json({ success: true, outcome: finalOutcome })
  } catch (error: any) {
    console.error('Error casting vote:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

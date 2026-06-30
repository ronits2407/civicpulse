import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { createIssuePipeline, checkpointer } from '@/lib/agents/pipeline'

export async function POST(request: Request) {
  try {
    const { issueId } = await request.json()
    if (!issueId) {
      return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // Fetch the issue
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .single()

    if (fetchError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (issue.pipeline_stage !== 'agent4_resolution' && issue.pipeline_stage !== 'awaiting_community_review') {
      return NextResponse.json({ error: 'Issue is not in a resumable state for community review' }, { status: 400 })
    }

    // Run asynchronously via `after()`
    after(async () => {
      try {
        console.log(`[Pipeline Resume] Resuming graph execution for issue ${issueId} from community_review_wait...`)
        
        // We initialize the pipeline
        const pipeline = await createIssuePipeline()
        
        // Use the issueId as the LangGraph thread_id
        const config = { configurable: { thread_id: issueId } }
        
        // Update the state so the graph knows community review passed (or we just let it proceed)
        // By invoking with null input, it simply resumes from the interrupt
        await pipeline.invoke(null, config)
        
        console.log(`[Pipeline Resume] Pipeline resumed and finished for issue ${issueId}`)
      } catch (err) {
        console.error(`[Pipeline Resume] Background pipeline error for issue ${issueId}:`, err)
        // Fallback: If memory saver state is lost (e.g. server restart), we call the retry endpoint
        console.log(`[Pipeline Resume] LangGraph thread lost (server restart?). Falling back to /api/reports/retry...`);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        await fetch(`${appUrl}/api/reports/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId })
        }).catch(e => console.error('Fallback retry failed:', e))
      }
    })

    return NextResponse.json({ success: true, resumed: true })
  } catch (error: any) {
    console.error('Error in resume endpoint:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

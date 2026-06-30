import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { createIssuePipeline } from '@/lib/agents/pipeline'
import { AgentState } from '@/lib/db/types'

export async function POST(request: Request) {
  try {
    const { issueId } = await request.json()
    if (!issueId) {
      return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // 1. Fetch the issue
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .single()

    if (fetchError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (!issue.pipeline_stage?.endsWith('_failed') && issue.pipeline_stage !== 'agent4_resolution') {
      return NextResponse.json({ error: 'Issue is not in a failed or resumable state' }, { status: 400 })
    }

    // 2. Determine start node
    const failedStage = issue.pipeline_stage.replace('_failed', '')
    let startNode: 'translate' | 'classify' | 'deduplicate' | 'validate' | 'resolve' = 'classify'
    
    if (failedStage === 'agent0_translation') startNode = 'translate'
    else if (failedStage === 'agent2_deduplication') startNode = 'deduplicate'
    else if (failedStage === 'agent3_validation') startNode = 'validate'
    else if (failedStage === 'agent4_resolution') startNode = 'resolve'
    else startNode = 'classify'

    // 3. Revert pipeline_stage back to IN_PROGRESS mode
    await supabase
      .from('issues')
      .update({ pipeline_stage: failedStage })
      .eq('id', issueId)

    // 4. Reconstruct AgentState
    const state: AgentState = {
      reportId: issueId,
      rawText: issue.description || '',
      imageUrl: issue.photo_url || null,
      videoUrl: (issue as any).video_url || null,
      imageAnalysis: (issue as any).image_analysis || '',
      coordinates: { lat: 0, lng: 0 }, // PostGIS coords not needed for resolve/validate
      address: issue.address || '',
      userId: issue.user_id,
      originalLanguage: issue.original_language || 'English',
      englishTranslation: issue.description || '',
      translationTrace: issue.translation_trace || '',
      classification: issue.category ? {
        category: issue.category,
        subcategory: issue.subcategory,
        severity: issue.severity,
        is_emergency: issue.is_emergency,
        suggested_title: issue.title,
        department_id: issue.department_id
      } : null,
      deduplication: issue.cluster_id ? {
        is_duplicate: true,
        cluster_id: issue.cluster_id,
        existing_issue_id: issue.cluster_id,
        similarity_score: 1
      } : null,
      validation: issue.credibility_score ? {
        credibility_score: issue.credibility_score,
        reasoning: '',
        needs_community_verification: issue.credibility_score < 0.6,
        weather_corroborated: true
      } : null,
      resolution: issue.civic_brief ? {
        civic_brief: issue.civic_brief,
        sla_hours: 72,
        sla_deadline: issue.sla_deadline,
      } : null,
      error: null
    }

    // 5. Run asynchronously via `after()`
    after(async () => {
      try {
        console.log(`[Pipeline Retry] Resuming pipeline for issue ${issueId} from node ${startNode}...`)
        const pipeline = await createIssuePipeline(startNode)
        const config = { configurable: { thread_id: issueId } }
        await pipeline.invoke(state as any, config)
        console.log(`[Pipeline Retry] Pipeline finished for issue ${issueId}`)
      } catch (err) {
        console.error(`[Pipeline Retry] Background pipeline error for issue ${issueId}:`, err)
        // Set it back to failed
        const failClient = createServiceClient()
        await failClient.from('issues').update({ pipeline_stage: `${failedStage}_failed` }).eq('id', issueId)
      }
    })

    return NextResponse.json({ success: true, resumed_from: startNode })
  } catch (error: any) {
    console.error('Error in retry endpoint:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { createIssuePipeline } from '@/lib/agents/pipeline'
import { generateEmbedding } from '@/lib/ai/client'
import { AgentState } from '@/lib/db/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, imageUrl, videoUrl, coordinates, userId } = body

    if (!text || !coordinates || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: text, coordinates, userId' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const embedding = await generateEmbedding(text)

    const { data: issue, error: insertError } = await supabase
      .from('issues')
      .insert({
        user_id: userId,
        description: text,
        photo_url: imageUrl || null,
        video_url: videoUrl || null,
        location: `POINT(${coordinates.lng} ${coordinates.lat})`,
        address: coordinates.address || '',
        status: 'open',
        embedding,
        pipeline_stage: 'agent0_translation'
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Award +10 karma for reporting an issue
    await supabase.from('karma_events').insert({
      user_id: userId,
      event_type: 'issue_reported',
      points: 10,
      issue_id: issue.id,
    })

    const pipeline = await createIssuePipeline()

    const initialState: AgentState = {
      reportId: issue.id,
      rawText: text,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      coordinates,
      address: coordinates.address || '',
      userId,
      originalLanguage: 'English',
      englishTranslation: '',
      translationTrace: '',
      classification: null,
      deduplication: null,
      validation: null,
      resolution: null,
      error: null,
      imageAnalysis: '',
    }

    // Run asynchronously in the background using Next.js after()
    after(() => {
      const config = { configurable: { thread_id: issue.id } };
      pipeline.invoke(initialState as any, config).catch(async (err) => {
        console.error('Pipeline Background Error:', err)
        await supabase.from('issues').update({ pipeline_stage: 'failed' }).eq('id', issue.id)
      })
    })

    return NextResponse.json({
      success: true,
      issueId: issue.id,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
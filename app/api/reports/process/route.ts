import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { createIssuePipeline } from '@/lib/agents/pipeline'
import { generateEmbedding } from '@/lib/gemini/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, imageUrl, coordinates, userId } = body

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
        location: `POINT(${coordinates.lng} ${coordinates.lat})`,
        address: coordinates.address || '',
        status: 'open',
        embedding,
      })
      .select()
      .single()

    if (insertError) throw insertError

    const pipeline = await createIssuePipeline()

    const initialState = {
      reportId: issue.id,
      rawText: text,
      imageUrl: imageUrl || null,
      coordinates,
      userId,
      classification: null,
      deduplication: null,
      validation: null,
      resolution: null,
      error: null,
    }

    const finalState = await pipeline.invoke(initialState)

    return NextResponse.json({
      success: true,
      issueId: issue.id,
      isDuplicate: finalState.deduplication?.is_duplicate || false,
      classification: finalState.classification,
      credibilityScore: finalState.validation?.credibility_score,
      needsVerification: finalState.validation?.needs_community_verification,
      slaDeadline: finalState.resolution?.sla_deadline,
      error: finalState.error,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
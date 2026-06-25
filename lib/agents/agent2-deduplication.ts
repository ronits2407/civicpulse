import { generateEmbedding } from '@/lib/ai/client'
import { AgentState, DeduplicationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const SIMILARITY_THRESHOLD = 0.85
const PROXIMITY_METERS = 200

export async function runDeduplicationAgent(state: AgentState): Promise<AgentState> {
  try {
    const supabase = createServiceClient()

    const embedding = await generateEmbedding(state.rawText)

    const { data: vectorMatches } = await supabase.rpc('match_issues', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: 5,
    })

    if (vectorMatches && vectorMatches.length > 0) {
      const topMatch = vectorMatches[0]

      await supabase
        .from('issues')
        .update({ cluster_id: topMatch.cluster_id || topMatch.id })
        .eq('id', topMatch.id)

      return {
        ...state,
        deduplication: {
          is_duplicate: true,
          cluster_id: topMatch.cluster_id || topMatch.id,
          existing_issue_id: topMatch.id,
          similarity_score: topMatch.similarity,
        },
      }
    }

    const { data: proximityMatches } = await supabase.rpc('issues_within_radius', {
      lat: state.coordinates.lat,
      lng: state.coordinates.lng,
      radius_meters: PROXIMITY_METERS,
      category: state.classification?.category,
    })

    if (proximityMatches && proximityMatches.length > 0) {
      const nearby = proximityMatches[0]
      return {
        ...state,
        deduplication: {
          is_duplicate: true,
          cluster_id: nearby.cluster_id || nearby.id,
          existing_issue_id: nearby.id,
          similarity_score: 0.7,
        },
      }
    }

    return {
      ...state,
      deduplication: {
        is_duplicate: false,
        cluster_id: null,
        existing_issue_id: null,
        similarity_score: 0,
      },
    }
  } catch (error: any) {
    return {
      ...state,
      error: `Deduplication agent failed: ${error.message}`,
    }
  }
}
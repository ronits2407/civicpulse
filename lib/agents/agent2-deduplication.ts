import { generateEmbedding } from '@/lib/ai/client'
import { AgentState, DeduplicationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const SIMILARITY_THRESHOLD = 0.85
const PROXIMITY_METERS = 200

export async function runDeduplicationAgent(state: AgentState): Promise<AgentState> {
  console.log('[Agent 2: Deduplicator] Starting deduplication for issue:', state.issueId || state.reportId || 'unknown');
  try {
    const supabase = createServiceClient()

    console.log('[Agent 2: Deduplicator] Generating embedding for raw text...');
    const embedding = await generateEmbedding(state.rawText)

    console.log('[Agent 2: Deduplicator] Searching for vector matches...');
    const { data: vectorMatches, error: vectorError } = await supabase.rpc('match_issues', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: 5,
    })

    if (vectorError) {
      console.error('[Agent 2: Deduplicator] Error fetching vector matches:', vectorError);
    } else if (vectorMatches && vectorMatches.length > 0) {
      const topMatch = vectorMatches[0]
      console.log('[Agent 2: Deduplicator] Found vector match. Cluster ID:', topMatch.cluster_id || topMatch.id);

      // Update current issue
      await supabase.from('issues').update({ 
        cluster_id: topMatch.cluster_id || topMatch.id,
        pipeline_stage: 'completed',
        status: 'closed'
      }).eq('id', state.reportId)

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

    console.log('[Agent 2: Deduplicator] No vector match found. Searching for proximity matches...');
    const { data: proximityMatches, error: proximityError } = await supabase.rpc('issues_within_radius', {
      lat: state.coordinates.lat,
      lng: state.coordinates.lng,
      radius_meters: PROXIMITY_METERS,
      category: state.classification?.category,
    })

    if (proximityError) {
      console.error('[Agent 2: Deduplicator] Error fetching proximity matches:', proximityError);
    } else if (proximityMatches && proximityMatches.length > 0) {
      const nearby = proximityMatches[0]
      console.log('[Agent 2: Deduplicator] Found proximity match. Cluster ID:', nearby.cluster_id || nearby.id);
      
      await supabase.from('issues').update({ 
        cluster_id: nearby.cluster_id || nearby.id,
        pipeline_stage: 'completed',
        status: 'closed'
      }).eq('id', state.reportId)

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

    const noDupResult = {
      is_duplicate: false,
      cluster_id: null,
      existing_issue_id: null,
      similarity_score: 0,
    }

    console.log('[Agent 2: Deduplicator] No duplicates found. Advancing pipeline stage.');

    await supabase.from('issues').update({
      pipeline_stage: 'agent3_validation'
    }).eq('id', state.reportId)

    console.log('[Agent 2: Deduplicator] Completed successfully (Not a duplicate).');
    return {
      ...state,
      deduplication: noDupResult,
    }
  } catch (error: any) {
    console.error('[Agent 2: Deduplicator] Fatal error during deduplication:', error);
    return {
      ...state,
      error: `Deduplication agent failed: ${error.message}`,
    }
  }
}
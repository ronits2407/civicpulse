import { generateEmbedding, generateStructuredJSON, generateText } from '@/lib/ai/client'
import { AgentState, DeduplicationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const SIMILARITY_THRESHOLD = 0.85
const PROXIMITY_METERS = 200

export async function runDeduplicationAgent(state: AgentState): Promise<AgentState> {
  const startTime = Date.now();
  console.log('[Agent 2: Deduplicator] Starting deduplication for issue:', state.issueId || state.reportId || 'unknown');
  try {
    const supabase = createServiceClient()

    // NOTE: We deliberately removed global vector searching ('match_issues').
    // Deduplication should ONLY occur within a physical 200m radius of the reported issue.
    // If two issues are identical but 5km apart, they are NOT the same issue.

    let confirmedDuplicate = null;
    let similarityScore = 0;

    async function verifyDuplicateWithAI(candidateId: string): Promise<boolean> {
      const { data: existingIssue } = await supabase.from('issues').select('description, title').eq('id', candidateId).single();
      if (!existingIssue) return false;
      const existingText = `${existingIssue.title || ''} ${existingIssue.description}`;
      const prompt = `Report A: ${state.rawText}\nReport B: ${existingText}`;
      const systemInstruction = `You are a deduplication engine for a civic issue reporting system.
You will be given two civic issue reports that occurred near the same location.
Your job is to determine if they are describing the EXACT SAME physical problem.
For example, if one is "Traffic light broken" and the other is "Pothole", they are NOT the same, even if at the same intersection.
If one is "Deep pothole outside school" and the other is "Huge crater near the school entrance", they ARE the same.
Return a JSON object: { "is_same_issue": boolean, "reasoning": "brief explanation" }`;
      try {
        const result = await generateStructuredJSON<{ is_same_issue: boolean; reasoning: string }>(prompt, systemInstruction);
        console.log(`[Agent 2: Deduplicator] AI Verification for ${candidateId}: ${result.is_same_issue} - ${result.reasoning}`);
        return result.is_same_issue;
      } catch (e) {
        console.error('[Agent 2: AI Deduplication] LLM verification failed', e);
        return false;
      }
    }

    if (!confirmedDuplicate) {
      console.log('[Agent 2: Deduplicator] Searching for proximity matches within 200m...');
      const { data: proximityMatches, error: proximityError } = await supabase.rpc('issues_within_radius', {
        lat: state.coordinates.lat,
        lng: state.coordinates.lng,
        radius_meters: PROXIMITY_METERS,
        category: state.classification?.category,
      })

      if (proximityError) {
        console.error('[Agent 2: Deduplicator] Error fetching proximity matches:', proximityError);
      } else {
        const validProximityMatches = proximityMatches?.filter((m: any) => m.id !== state.reportId) || []
        for (const match of validProximityMatches) {
          const isSame = await verifyDuplicateWithAI(match.id);
          if (isSame) {
            confirmedDuplicate = match;
            similarityScore = 0.7; // Fallback score for proximity
            break;
          }
        }
      }
    }

    if (confirmedDuplicate) {
      console.log('[Agent 2: Deduplicator] Confirmed duplicate found. Cluster ID:', confirmedDuplicate.cluster_id || confirmedDuplicate.id);

      let targetClusterId = confirmedDuplicate.cluster_id;

      if (!targetClusterId) {
        console.log(`[Agent 2: Deduplicator] No existing cluster found for match. Creating new cluster...`);
        const { data: newCluster, error: clusterError } = await supabase.from('issue_clusters').insert({
          representative_issue_id: confirmedDuplicate.id,
          issue_count: 1,
          category: confirmedDuplicate.category || null
        }).select().single();

        if (clusterError) {
          console.error(`[Agent 2: Deduplicator] Failed to create new cluster:`, clusterError);
          throw new Error('Failed to create new cluster');
        }

        targetClusterId = newCluster.id;

        // Also update the original matched issue to belong to this new cluster
        await supabase.from('issues').update({ cluster_id: targetClusterId }).eq('id', confirmedDuplicate.id);
      }

      // Active Cluster Manager: synthesize evolving situation
      try {
        console.log(`[Agent 2: Active Cluster Manager] Synthesizing evolving situation update...`);
        const { data: parentIssue } = await supabase.from('issues').select('title, description').eq('id', confirmedDuplicate.id).single();
        if (parentIssue) {
          const synthesisPrompt = `
Parent Issue:
Title: ${parentIssue.title || 'Unknown'}
Description: ${parentIssue.description}

New Duplicate Report:
Description: ${state.rawText}

Synthesize a brief "Evolving Situation Update" (1-2 sentences) that combines insights from the new report into the parent issue.
Only output the update text, no quotes or preamble.`;
          const updateText = await generateText(synthesisPrompt, "You are an active cluster manager for civic issues.");
          console.log(`[Agent 2: Active Cluster Manager] Synthesis: ${updateText}`);
          
          // Append to parent issue description
          const newDescription = `${parentIssue.description}\n\n[Update]: ${updateText}`;
          await supabase.from('issues').update({ description: newDescription }).eq('id', confirmedDuplicate.id);
        }
      } catch (synthError) {
        console.error(`[Agent 2: Active Cluster Manager] Failed to synthesize update:`, synthError);
      }

      console.log(`[Agent 2: Deduplicator] Updating current issue ${state.reportId} as duplicate (completed)...`);
      const { error: updateError } = await supabase.from('issues').update({ 
        cluster_id: targetClusterId,
        pipeline_stage: 'completed',
        status: 'closed'
      }).eq('id', state.reportId)

      if (updateError) {
        console.error(`[Agent 2: Deduplicator] Error updating duplicate issue:`, updateError);
        throw new Error('Failed to update duplicate issue');
      }

      console.log(`[Agent 2: Deduplicator] Completed successfully (Duplicate detected).`);

      const elapsed = Date.now() - startTime;
      if (elapsed < 15000) {
        console.log(`[Agent 2: Deduplicator] Waiting for ${15000 - elapsed}ms to fulfill 15-second visual requirement...`);
        await new Promise(resolve => setTimeout(resolve, 15000 - elapsed));
      }

      return {
        ...state,
        deduplication: {
          is_duplicate: true,
          cluster_id: targetClusterId,
          existing_issue_id: confirmedDuplicate.id,
          similarity_score: similarityScore,
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

    const elapsed = Date.now() - startTime;
    if (elapsed < 15000) {
      console.log(`[Agent 2: Deduplicator] Waiting for ${15000 - elapsed}ms to fulfill 15-second visual requirement...`);
      await new Promise(resolve => setTimeout(resolve, 15000 - elapsed));
    }
    return {
      ...state,
      deduplication: noDupResult,
    }
  } catch (error: any) {
    console.error('[Agent 2: Deduplicator] Fatal error during deduplication:', error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'agent2_deduplication_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error('[Agent 2: Deduplicator] Failed to update pipeline_stage to failed:', e);
    }
    return {
      ...state,
      error: `Deduplication agent failed: ${error.message}`,
    }
  }
}
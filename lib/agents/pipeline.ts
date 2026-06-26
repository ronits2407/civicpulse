import { StateGraph, END } from '@langchain/langgraph'
import { AgentState } from '@/lib/db/types'
import { runClassifierAgent } from './agent1-classifier'
import { runDeduplicationAgent } from './agent2-deduplication'
import { runValidationAgent } from './agent3-validation'
import { runResolutionAgent } from './agent4-resolution'
import { createServiceClient } from '@/lib/db/server'

function shouldContinueAfterDedup(state: AgentState): string {
  if (state.error) return 'end'
  if (state.deduplication?.is_duplicate) return 'end'
  return 'validate'
}

function shouldContinueAfterValidation(state: AgentState): string {
  if (state.error) return 'end'
  return 'resolve'
}

function shouldContinueAfterClassify(state: AgentState): string {
  if (state.error) return 'end'
  return 'deduplicate'
}

export async function createIssuePipeline(startNode: 'classify' | 'deduplicate' | 'validate' | 'resolve' = 'classify') {
  const workflow = new StateGraph<AgentState>({
    channels: {
      reportId: { value: (x: string, y: string) => y ?? x, default: () => '' },
      rawText: { value: (x: string, y: string) => y ?? x, default: () => '' },
      imageUrl: { value: (x: any, y: any) => y ?? x, default: () => null },
      coordinates: { value: (x: any, y: any) => y ?? x, default: () => ({ lat: 0, lng: 0 }) },
      userId: { value: (x: string, y: string) => y ?? x, default: () => '' },
      classification: { value: (x: any, y: any) => y ?? x, default: () => null },
      deduplication: { value: (x: any, y: any) => y ?? x, default: () => null },
      validation: { value: (x: any, y: any) => y ?? x, default: () => null },
      resolution: { value: (x: any, y: any) => y ?? x, default: () => null },
      error: { value: (x: any, y: any) => y ?? x, default: () => null },
      imageAnalysis: { value: (x: string, y: string) => y ?? x, default: () => '' },
      address: { value: (x: string, y: string) => y ?? x, default: () => '' },
    },
  })

  workflow.addNode('router', (state) => state)
  workflow.addNode('classify', runClassifierAgent)
  workflow.addNode('deduplicate', runDeduplicationAgent)
  workflow.addNode('validate', runValidationAgent)
  workflow.addNode('resolve', runResolutionAgent)
  workflow.addNode('save', saveToDatabase)

  workflow.setEntryPoint('router' as any)
  workflow.addConditionalEdges('router' as any, () => startNode, {
    classify: 'classify',
    deduplicate: 'deduplicate',
    validate: 'validate',
    resolve: 'resolve',
  } as any)
  workflow.addConditionalEdges('classify' as any, shouldContinueAfterClassify, {
    deduplicate: 'deduplicate',
    end: 'save',
  } as any)
  workflow.addConditionalEdges('deduplicate' as any, shouldContinueAfterDedup, {
    validate: 'validate',
    end: 'save',
  } as any)
  workflow.addConditionalEdges('validate' as any, shouldContinueAfterValidation, {
    resolve: 'resolve',
    end: 'save',
  } as any)
  workflow.addEdge('resolve' as any, 'save' as any)
  workflow.addEdge('save' as any, END as any)

  return workflow.compile()
}

async function saveToDatabase(state: AgentState): Promise<AgentState> {
  console.log(`[Pipeline] saveToDatabase triggered for issue ${state.reportId}`);
  try {
    const supabase = createServiceClient()

    if (state.deduplication?.is_duplicate && state.deduplication.existing_issue_id) {
      console.log(`[Pipeline] Issue is a duplicate. Incrementing cluster count for ${state.deduplication.cluster_id}...`);
      const { error } = await supabase.rpc('increment_cluster_count', {
        cluster_id: state.deduplication.cluster_id,
      })
      if (error) {
        console.error(`[Pipeline] Error incrementing cluster count:`, error);
      } else {
        console.log(`[Pipeline] Cluster count incremented successfully.`);
      }
    }

    console.log(`[Pipeline] Finished saveToDatabase for issue ${state.reportId}`);
    return state
  } catch (error: any) {
    console.error(`[Pipeline] Fatal error in saveToDatabase:`, error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'save_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error('[Pipeline] Failed to update pipeline_stage to failed:', e);
    }
    return {
      ...state,
      error: `Database save failed: ${error.message}`,
    }
  }
}
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

export async function createIssuePipeline() {
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
    },
  })

  workflow.addNode('classify', runClassifierAgent)
  workflow.addNode('deduplicate', runDeduplicationAgent)
  workflow.addNode('validate', runValidationAgent)
  workflow.addNode('resolve', runResolutionAgent)
  workflow.addNode('save', saveToDatabase)

  workflow.setEntryPoint('classify')
  workflow.addEdge('classify', 'deduplicate')
  workflow.addConditionalEdges('deduplicate', shouldContinueAfterDedup, {
    validate: 'validate',
    end: 'save',
  })
  workflow.addConditionalEdges('validate', shouldContinueAfterValidation, {
    resolve: 'resolve',
    end: 'save',
  })
  workflow.addEdge('resolve', 'save')
  workflow.addEdge('save', END)

  return workflow.compile()
}

async function saveToDatabase(state: AgentState): Promise<AgentState> {
  try {
    const supabase = createServiceClient()

    if (state.deduplication?.is_duplicate && state.deduplication.existing_issue_id) {
      await supabase.rpc('increment_cluster_count', {
        cluster_id: state.deduplication.cluster_id,
      })
      return state
    }

    const { error } = await supabase.from('issues').update({
      title: state.classification?.suggested_title,
      category: state.classification?.category,
      subcategory: state.classification?.subcategory,
      severity: state.classification?.severity,
      is_emergency: state.classification?.is_emergency,
      department_id: state.resolution?.department_id || state.classification?.department_id,
      credibility_score: state.validation?.credibility_score,
      civic_brief: state.resolution?.civic_brief,
      sla_deadline: state.resolution?.sla_deadline,
      status: 'open',
    }).eq('id', state.reportId)

    if (error) throw error

    return state
  } catch (error: any) {
    return {
      ...state,
      error: `Database save failed: ${error.message}`,
    }
  }
}
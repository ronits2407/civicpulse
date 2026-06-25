import { generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ResolutionResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const RESOLUTION_SYSTEM = `You are a civic resolution intelligence agent for an Indian municipal corporation.
You draft professional civic action briefs and determine resolution timelines.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

const SLA_MAP: Record<string, Record<string, number>> = {
  infrastructure: { high: 24, medium: 72, low: 168 },
  sanitation: { high: 12, medium: 48, low: 96 },
  safety: { high: 6, medium: 24, low: 72 },
  utility: { high: 12, medium: 48, low: 96 },
  environment: { high: 48, medium: 120, low: 240 },
}

function getSLAHours(category: string, severity: number): number {
  const urgency = severity >= 7 ? 'high' : severity >= 4 ? 'medium' : 'low'
  return SLA_MAP[category]?.[urgency] || 72
}

const BRIEF_PROMPT = (
  text: string,
  classification: any,
  address: string,
  history: string
) => `
Draft a professional civic action brief for this issue.

Citizen report: "${text}"
Location: ${address}
Category: ${classification.category} / ${classification.subcategory}
Severity: ${classification.severity}/10
Emergency: ${classification.is_emergency}
Historical context: ${history}

Return JSON with exactly these fields:
{
  "civic_brief": a 150-200 word professional brief in this format:
    "ISSUE SUMMARY: [what was reported]
     LOCATION: [address]
     EVIDENCE: [description of evidence available]
     URGENCY: [why this needs attention now]
     HISTORICAL CONTEXT: [past issues at this location if any]
     RECOMMENDED ACTION: [specific action for the civic department]
     PRIORITY: [High/Medium/Low]",
  "sla_hours": integer hours to resolve,
  "sla_deadline": ISO timestamp string for deadline,
  "department_id": "${classification.department_id || 'unassigned'}"
}
`

export async function runResolutionAgent(state: AgentState): Promise<AgentState> {
  try {
    const supabase = createServiceClient()

    const { data: historicalIssues } = await supabase
      .from('issues')
      .select('title, status, created_at, resolved_at, category')
      .eq('address', state.coordinates)
      .eq('category', state.classification?.category)
      .order('created_at', { ascending: false })
      .limit(3)

    let historyContext = 'No previous issues at this location.'
    if (historicalIssues && historicalIssues.length > 0) {
      historyContext = historicalIssues
        .map(
          (i: any) =>
            `${i.title} (${i.status}, reported ${new Date(i.created_at).toLocaleDateString()})`
        )
        .join('; ')
    }

    const slaHours = getSLAHours(
      state.classification?.category || 'infrastructure',
      state.classification?.severity || 5
    )

    const slaDeadline = new Date(
      Date.now() + slaHours * 60 * 60 * 1000
    ).toISOString()

    const resolution = await generateStructuredJSON<ResolutionResult>(
      BRIEF_PROMPT(
        state.rawText,
        state.classification,
        'Location coordinates: ' + JSON.stringify(state.coordinates),
        historyContext
      ),
      RESOLUTION_SYSTEM
    )

    resolution.sla_hours = slaHours
    resolution.sla_deadline = slaDeadline

    return {
      ...state,
      resolution,
    }
  } catch (error: any) {
    return {
      ...state,
      error: `Resolution agent failed: ${error.message}`,
    }
  }
}
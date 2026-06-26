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
  "civic_brief": "A single continuous string (150-200 words) containing the professional brief. Use standard text with newline characters (\\n) if needed, but DO NOT output a nested JSON object. Include Issue Summary, Location, Evidence, Urgency, Historical Context, Recommended Action, and Priority.",
  "sla_hours": integer hours to resolve,
  "sla_deadline": ISO timestamp string for deadline,
  "department_id": "${classification.department_id || 'unassigned'}"
}
`

export async function runResolutionAgent(state: AgentState): Promise<AgentState> {
  console.log(`[Agent 4: Resolution Planner] Starting resolution planning for issue: ${state.issueId || state.reportId || 'unknown'}`);
  try {
    const supabase = createServiceClient()

    console.log(`[Agent 4: Resolution Planner] Fetching historical issues at this location...`);

    const { data: historicalIssues } = await supabase
      .from('issues')
      .select('title, status, created_at, resolved_at, category')
      .eq('address', state.coordinates)
      .eq('category', state.classification?.category)
      .order('created_at', { ascending: false })
      .limit(3)

    let historyContext = 'No previous issues at this location.'
    if (historicalIssues && historicalIssues.length > 0) {
      console.log(`[Agent 4: Resolution Planner] Found ${historicalIssues.length} historical issues.`);
      historyContext = historicalIssues
        .map(
          (i: any) =>
            `${i.title} (${i.status}, reported ${new Date(i.created_at).toLocaleDateString()})`
        )
        .join('; ')
    } else {
      console.log(`[Agent 4: Resolution Planner] No historical issues found.`);
    }

    const slaHours = getSLAHours(
      state.classification?.category || 'infrastructure',
      state.classification?.severity || 5
    )

    const slaDeadline = new Date(
      Date.now() + slaHours * 60 * 60 * 1000
    ).toISOString()

    console.log(`[Agent 4: Resolution Planner] Calculated SLA: ${slaHours} hours (Deadline: ${slaDeadline})`);
    console.log(`[Agent 4: Resolution Planner] Requesting civic brief generation from LLM...`);

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

    console.log(`[Agent 4: Resolution Planner] Resolution brief generated successfully.`);
    console.log(`[Agent 4: Resolution Planner] Updating issue with department ID, civic brief, and completing pipeline stage...`);

    await supabase.from('issues').update({
      department_id: resolution.department_id,
      civic_brief: resolution.civic_brief,
      sla_deadline: resolution.sla_deadline,
      pipeline_stage: 'completed'
    }).eq('id', state.reportId)

    console.log(`[Agent 4: Resolution Planner] Completed successfully.`);
    return {
      ...state,
      resolution,
    }
  } catch (error: any) {
    console.error(`[Agent 4: Resolution Planner] Fatal error during resolution planning:`, error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'agent4_resolution_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error(`[Agent 4: Resolution Planner] Failed to update pipeline_stage to failed:`, e);
    }
    return {
      ...state,
      error: `Resolution agent failed: ${error.message}`,
    }
  }
}
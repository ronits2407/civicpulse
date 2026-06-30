import { generateStructuredJSON, generateEmbedding } from '@/lib/ai/client'
import { AgentState, ResolutionResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const RESOLUTION_SYSTEM = `You are a civic resolution intelligence agent for an Indian municipal corporation.
You draft professional civic action briefs and determine resolution timelines (SLA).
You will be provided with Standard Operating Procedure (SOP) Guidelines retrieved from the knowledge base.
You MUST calculate the SLA hours based strictly on the provided SOP guidelines.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

const BRIEF_PROMPT = (
  text: string,
  imageAnalysis: string,
  classification: any,
  address: string,
  history: string,
  sopContext: string,
  originalLanguage?: string
) => `
Draft a professional civic action brief for this issue and determine the SLA deadline.

Citizen report: "${text}"
Visual Evidence Analysis: ${imageAnalysis || 'None provided'}
Location: ${address}
Category: ${classification.category} / ${classification.subcategory}
Severity: ${classification.severity}/10
Emergency: ${classification.is_emergency}
Historical context: ${history}

Standard Operating Procedures (SOPs) for this issue:
${sopContext || 'No specific SOPs found. Default to standard 72-hour SLA.'}

Return JSON with exactly these fields:
{
  "civic_brief": "A single continuous string (150-200 words) containing the professional brief in English. IMPORTANT: DO NOT use actual newlines inside this string. Use literal text '\\n' for paragraph breaks. DO NOT use any double quotes (\\") inside this string. Use single quotes (') if you need to quote something.",
  ${originalLanguage && originalLanguage.toLowerCase() !== 'english' && originalLanguage.toLowerCase() !== 'en' ? `"local_civic_brief": "The exact same professional brief but translated to ${originalLanguage}. Use the same formatting rules.",` : ''}
  "sla_hours": integer hours to resolve (derived from SOPs)
}
`

export async function runResolutionAgent(state: AgentState): Promise<AgentState> {
  console.log(`[Agent 4: Resolution Planner] Starting RAG-based resolution planning for issue: ${state.issueId || state.reportId || 'unknown'}`);
  try {
    const supabase = createServiceClient()

    // 1. Fetch historical issues
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
    }

    // 2. RAG Retrieval for SOPs
    console.log(`[Agent 4: Resolution Planner] Retrieving SOPs from Knowledge Base...`);
    let sopContext = 'No SOP retrieved.';
    try {
      const issueEmbedding = await generateEmbedding(state.englishTranslation || state.rawText);
      const { data: sops, error: sopError } = await supabase.rpc('match_sops', {
        query_embedding: issueEmbedding,
        match_threshold: 0.5,
        match_count: 2,
        filter_category: state.classification?.category
      });
      
      if (!sopError && sops && sops.length > 0) {
        sopContext = sops.map((s: any) => s.content).join('\n\n');
        console.log(`[Agent 4: Resolution Planner] Successfully retrieved ${sops.length} relevant SOPs.`);
      } else {
        console.log(`[Agent 4: Resolution Planner] No highly relevant SOPs found or error occurred.`);
      }
    } catch (ragError) {
      console.warn(`[Agent 4: Resolution Planner] Failed to retrieve SOPs via RAG:`, ragError);
    }

    // 3. Prompt LLM
    console.log(`[Agent 4: Resolution Planner] Requesting civic brief generation from LLM...`);
    const promptText = BRIEF_PROMPT(
      state.englishTranslation || state.rawText,
      state.imageAnalysis || '',
      state.classification,
      state.address || 'Location recorded',
      historyContext,
      sopContext,
      state.originalLanguage
    );
    
    console.log(`\n============== [Agent 4: Resolution Prompt] ==============`);
    console.log(promptText);
    console.log(`==========================================================\n`);

    const resolution = await generateStructuredJSON<ResolutionResult>(
      promptText,
      RESOLUTION_SYSTEM
    )
    
    console.log(`\n============== [Agent 4: Resolution Output] ==============`);
    console.log(JSON.stringify(resolution, null, 2));
    console.log(`==========================================================\n`);

    // Calculate actual deadline from LLM's suggested sla_hours. Ignore any hallucinated date from the LLM.
    resolution.sla_deadline = new Date(Date.now() + (resolution.sla_hours || 72) * 60 * 60 * 1000).toISOString();

    console.log(`[Agent 4: Resolution Planner] Resolution brief generated successfully with SLA ${resolution.sla_hours}h.`);
    console.log(`[Agent 4: Resolution Planner] Updating issue with department ID, civic brief, and completing pipeline stage...`);

    const finalDepartmentId = state.classification?.department_id || null

    const { error: updateError } = await supabase.from('issues').update({
      department_id: finalDepartmentId,
      civic_brief: resolution.civic_brief,
      local_civic_brief: resolution.local_civic_brief || null,
      sla_deadline: resolution.sla_deadline,
      pipeline_stage: 'completed'
    }).eq('id', state.reportId)

    if (updateError) {
      console.error(`[Agent 4: Resolution Planner] Database update failed:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

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
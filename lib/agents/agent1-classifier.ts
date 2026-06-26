import { generateStructuredJSON, analyzeImage } from '@/lib/ai/client'
import { AgentState, ClassificationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const CLASSIFIER_SYSTEM = `You are a civic issue classification agent for an Indian city. 
Your job is to analyze citizen reports and classify them accurately.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

const CLASSIFIER_PROMPT = (text: string, imageAnalysis: string) => `
Analyze this civic issue report and classify it.

Report text: "${text}"
${imageAnalysis ? `Visual analysis: "${imageAnalysis}"` : ''}

Return a JSON object with exactly these fields:
{
  "category": one of ["infrastructure", "sanitation", "safety", "utility", "environment"],
  "subcategory": specific type like "pothole", "streetlight", "garbage", "water_leakage" etc,
  "severity": integer 1-10 where 10 is life-threatening emergency,
  "is_emergency": boolean, true only if severity >= 8 or immediate danger,
  "suggested_title": short clear title under 10 words,
  "department_id": null
}
`

const IMAGE_ANALYSIS_PROMPT = `You are analyzing an image of a civic issue in an Indian city.
Describe: what the problem is, visible severity, approximate location type (road/footpath/park/drain etc), 
any safety hazards visible. Be concise, under 100 words.`

export async function runClassifierAgent(state: AgentState): Promise<AgentState> {
  console.log('[Agent 1: Classifier] Starting classification for issue:', state.issueId || 'new issue');
  try {
    let imageAnalysis = ''

    if (state.imageUrl) {
      console.log('[Agent 1: Classifier] Image URL provided, starting image analysis...');
      imageAnalysis = await analyzeImage(state.imageUrl, IMAGE_ANALYSIS_PROMPT)
      console.log('[Agent 1: Classifier] Image analysis complete:', imageAnalysis);
    }

    console.log('[Agent 1: Classifier] Requesting structured JSON classification from LLM...');
    const classification = await generateStructuredJSON<ClassificationResult>(
      CLASSIFIER_PROMPT(state.rawText, imageAnalysis),
      CLASSIFIER_SYSTEM
    )
    console.log('[Agent 1: Classifier] Classification received:', classification);

    const supabase = createServiceClient()
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, category_scope')

    if (deptError) {
      console.error('[Agent 1: Classifier] Error fetching departments:', deptError);
    } else if (departments) {
      const matchingDept = departments.find((d: any) =>
        d.category_scope?.includes(classification.category)
      )
      if (matchingDept) {
        console.log('[Agent 1: Classifier] Matched department:', matchingDept.name);
        classification.department_id = matchingDept.id
      } else {
        console.warn('[Agent 1: Classifier] No matching department found for category:', classification.category);
      }
    }

    console.log('[Agent 1: Classifier] Completed successfully. Updating DB...');
    await supabase.from('issues').update({
      title: classification.suggested_title,
      category: classification.category,
      subcategory: classification.subcategory,
      severity: classification.severity,
      is_emergency: classification.is_emergency,
      pipeline_stage: 'agent2_deduplication'
    }).eq('id', state.reportId)

    console.log('[Agent 1: Classifier] Completed successfully.');
    return {
      ...state,
      classification,
      imageAnalysis: imageAnalysis || undefined
    }
  } catch (error: any) {
    console.error('[Agent 1: Classifier] Fatal error during classification:', error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'agent1_classifier_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error('[Agent 1: Classifier] Failed to update pipeline_stage to failed:', e);
    }
    return {
      ...state,
      error: `Classifier agent failed: ${error.message}`,
    }
  }
}
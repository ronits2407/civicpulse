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
  try {
    let imageAnalysis = ''

    if (state.imageUrl) {
      imageAnalysis = await analyzeImage(state.imageUrl, IMAGE_ANALYSIS_PROMPT)
    }

    const classification = await generateStructuredJSON<ClassificationResult>(
      CLASSIFIER_PROMPT(state.rawText, imageAnalysis),
      CLASSIFIER_SYSTEM
    )

    const supabase = createServiceClient()
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, category_scope')

    if (departments) {
      const matchingDept = departments.find((d: any) =>
        d.category_scope?.includes(classification.category)
      )
      if (matchingDept) {
        classification.department_id = matchingDept.id
      }
    }

    return {
      ...state,
      classification,
    }
  } catch (error: any) {
    return {
      ...state,
      error: `Classifier agent failed: ${error.message}`,
    }
  }
}
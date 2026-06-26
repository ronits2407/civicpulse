import { generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ValidationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const VALIDATION_SYSTEM = `You are a civic report validation agent. 
You assess credibility of citizen-reported civic issues using available evidence.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

async function fetchWeatherData(lat: number, lng: number): Promise<string> {
  try {
    console.log(`[Agent 3: Validator] Fetching weather data for lat/lng: ${lat}, ${lng}...`);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,rain,weathercode&past_days=1`
    const response = await fetch(url)
    const data = await response.json()
    const current = data.current
    const weatherStr = `Current precipitation: ${current.precipitation}mm, Rain: ${current.rain}mm, Weather code: ${current.weathercode}`
    console.log(`[Agent 3: Validator] Weather data retrieved: ${weatherStr}`);
    return weatherStr;
  } catch (err) {
    console.warn(`[Agent 3: Validator] Warning: Weather data unavailable.`, err);
    return 'Weather data unavailable'
  }
}

const VALIDATION_PROMPT = (
  text: string,
  category: string,
  severity: number,
  weather: string
) => `
Assess the credibility of this civic issue report.

Report: "${text}"
Category: ${category}
Severity claimed: ${severity}/10
Current weather at location: ${weather}

Consider:
- Is the reported issue consistent with current weather? (e.g., flooding during rain = credible)
- Does the description contain specific, verifiable details?
- Is the severity claim proportionate to the description?
- Are there any red flags suggesting exaggeration or false reporting?

Return JSON with exactly these fields:
{
  "credibility_score": integer 1-10,
  "reasoning": brief explanation under 50 words,
  "needs_community_verification": boolean, true if credibility_score < 6,
  "weather_corroborated": boolean
}
`

export async function runValidationAgent(state: AgentState): Promise<AgentState> {
  console.log(`[Agent 3: Validator] Starting credibility validation for issue: ${state.issueId || state.reportId || 'unknown'}`);
  try {
    const weather = await fetchWeatherData(
      state.coordinates.lat,
      state.coordinates.lng
    )

    console.log(`[Agent 3: Validator] Requesting structured credibility validation from LLM...`);
    const validation = await generateStructuredJSON<ValidationResult>(
      VALIDATION_PROMPT(
        state.rawText,
        state.classification?.category || 'unknown',
        state.classification?.severity || 5,
        weather
      ),
      VALIDATION_SYSTEM
    )
    console.log(`[Agent 3: Validator] Validation received:`, JSON.stringify(validation, null, 2));

    const supabase = createServiceClient()
    
    console.log(`[Agent 3: Validator] Advancing pipeline stage and updating credibility score...`);
    const { error: updateError } = await supabase.from('issues').update({
      credibility_score: validation.credibility_score,
      pipeline_stage: 'agent4_resolution'
    }).eq('id', state.reportId)

    if (updateError) {
      console.error(`[Agent 3: Validator] Database update failed:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`[Agent 3: Validator] Completed successfully.`);
    return {
      ...state,
      validation,
    }
  } catch (error: any) {
    console.error(`[Agent 3: Validator] Fatal error during validation:`, error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'agent3_validation_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error(`[Agent 3: Validator] Failed to update pipeline_stage to failed:`, e);
    }
    return {
      ...state,
      error: `Validation agent failed: ${error.message}`,
    }
  }
}
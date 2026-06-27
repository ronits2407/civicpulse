import { generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ValidationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const VALIDATION_SYSTEM = `You are a civic report validation agent. 
You assess credibility of citizen-reported civic issues using available evidence.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

const WEATHER_RELEVANCE_SYSTEM = `You determine if a reported civic issue might be caused or affected by weather conditions.
Return JSON with exactly this structure, no markdown or preamble:
{ "requires_weather_check": boolean }`

const WEATHER_RELEVANCE_PROMPT = (text: string, category: string) => `
Report: "${text}"
Category: ${category}

Does validating this issue require recent weather context (e.g. checking for heavy rain, wind, or storms)?
`

async function fetchWeatherData(lat: number, lng: number): Promise<string> {
  try {
    console.log(`[Agent 3: Validator] Fetching weather data for lat/lng: ${lat}, ${lng}...`);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weathercode,temperature_2m,windspeed_10m&daily=precipitation_sum&past_days=3&forecast_days=1&timezone=auto`
    const response = await fetch(url)
    const data = await response.json()
    
    if (!data.current || !data.daily) return 'Weather data unavailable'

    const current = data.current
    const daily = data.daily
    
    // Sum past 3 days of precipitation
    let pastRain = 0;
    if (daily.precipitation_sum && daily.precipitation_sum.length > 0) {
      // past_days=3 returns 4 days of data (3 past + 1 current/forecast)
      pastRain = daily.precipitation_sum.slice(0, 3).reduce((a: number, b: number) => a + (b || 0), 0)
    }

    const weatherStr = `Current Temp: ${current.temperature_2m}°C, Wind: ${current.windspeed_10m}km/h. Precipitation (Now): ${current.precipitation}mm. Precipitation (Past 3 Days Total): ${pastRain.toFixed(1)}mm.`
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
- Does the description contain verifiable details? (Note: Short reports like "Pothole here" are normal and should NOT be penalized for lack of detail).
- Is the severity claim proportionate to the description? (Trust the severity unless it is obviously fake or wildly exaggerated like "volcano erupting").
- Are there any red flags suggesting intentional spam, fake reporting, or impossible contradictions?

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
    console.log(`[Agent 3: Validator] Loop 1: Asking LLM if weather check is required...`);
    const weatherCheck = await generateStructuredJSON<{ requires_weather_check: boolean }>(
      WEATHER_RELEVANCE_PROMPT(state.rawText, state.classification?.category || 'unknown'),
      WEATHER_RELEVANCE_SYSTEM
    )
    
    console.log(`[Agent 3: Validator] Loop 1 result:`, weatherCheck);

    let weather = 'Not relevant to this issue type';
    
    if (weatherCheck.requires_weather_check) {
      console.log(`[Agent 3: Validator] Weather context deemed necessary. Fetching...`);
      weather = await fetchWeatherData(
        state.coordinates.lat,
        state.coordinates.lng
      )
    } else {
      console.log(`[Agent 3: Validator] Skipping weather fetch based on LLM assessment.`);
    }

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
    const isCommunityReview = validation.needs_community_verification;
    const { error: updateError } = await supabase.from('issues').update({
      credibility_score: validation.credibility_score,
      needs_community_verification: validation.needs_community_verification,
      reasoning: validation.reasoning,
      status: isCommunityReview ? 'community_review' : undefined,
      pipeline_stage: isCommunityReview ? 'awaiting_community_review' : 'agent4_resolution'
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
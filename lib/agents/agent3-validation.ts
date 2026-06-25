import { generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ValidationResult } from '@/lib/db/types'

const VALIDATION_SYSTEM = `You are a civic report validation agent. 
You assess credibility of citizen-reported civic issues using available evidence.
Always respond with valid JSON only. No preamble, no explanation, no markdown.`

async function fetchWeatherData(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,rain,weathercode&past_days=1`
    const response = await fetch(url)
    const data = await response.json()
    const current = data.current
    return `Current precipitation: ${current.precipitation}mm, Rain: ${current.rain}mm, Weather code: ${current.weathercode}`
  } catch {
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
  try {
    const weather = await fetchWeatherData(
      state.coordinates.lat,
      state.coordinates.lng
    )

    const validation = await generateStructuredJSON<ValidationResult>(
      VALIDATION_PROMPT(
        state.rawText,
        state.classification?.category || 'unknown',
        state.classification?.severity || 5,
        weather
      ),
      VALIDATION_SYSTEM
    )

    return {
      ...state,
      validation,
    }
  } catch (error: any) {
    return {
      ...state,
      error: `Validation agent failed: ${error.message}`,
    }
  }
}
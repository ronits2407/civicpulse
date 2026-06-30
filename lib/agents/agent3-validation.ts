import { getChatModel, generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ValidationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search'

const VALIDATION_SYSTEM = `You are a civic report validation agent for an Indian municipal corporation.
Your job is to assess the credibility of a citizen's civic issue report.
You have access to tools to check recent weather conditions and search the web for local news/events.

Instructions:
1. Think about whether weather could have caused the issue (e.g., flooding requires rain, fallen trees require wind). If so, call the get_weather_data tool. DO NOT call the weather tool for issues completely unrelated to weather, such as protests, garbage, or streetlights.
2. Think about whether there might be local news or events related to this issue (e.g., a major protest or construction). If so, call the web_search tool.
3. If visual evidence (an image analysis) is provided and it strongly corroborates the report, consider the report highly credible, especially for high-severity issues. In such cases, community verification should NOT be required.
4. Once you have used the tools and gathered the necessary facts, you MUST provide your final assessment as a plain JSON object. 

CRITICAL: Do NOT output tool-calling JSON like {"name": "web_search"...} as your final answer. When you are done searching, output ONLY the final assessment JSON.

The final assessment JSON MUST have exactly these fields:
{
  "credibility_score": integer 1-10,
  "reasoning": "brief explanation under 50 words",
  "needs_community_verification": boolean, (true if credibility_score < 6),
  "weather_corroborated": boolean
}`

const getWeatherTool = tool(
  async ({ lat, lng }) => {
    try {
      console.log(`[Agent 3: Tool] Fetching weather for lat/lng: ${lat}, ${lng}...`);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weathercode,temperature_2m,windspeed_10m&daily=precipitation_sum&past_days=3&forecast_days=1&timezone=auto`
      const response = await fetch(url)
      const data = await response.json()
      
      if (!data.current || !data.daily) return 'Weather data unavailable'

      const current = data.current
      const daily = data.daily
      
      let pastRain = 0;
      if (daily.precipitation_sum && daily.precipitation_sum.length > 0) {
        pastRain = daily.precipitation_sum.slice(0, 3).reduce((a: number, b: number) => a + (b || 0), 0)
      }

      return `Current Temp: ${current.temperature_2m}°C, Wind: ${current.windspeed_10m}km/h. Precipitation (Now): ${current.precipitation}mm. Precipitation (Past 3 Days Total): ${pastRain.toFixed(1)}mm.`
    } catch (err) {
      console.warn(`[Agent 3: Tool] Weather data unavailable.`, err);
      return 'Weather data unavailable'
    }
  },
  {
    name: "get_weather_data",
    description: "Fetches current weather and past 3 days precipitation for a location.",
    schema: z.object({
      lat: z.number().describe("Latitude of the location"),
      lng: z.number().describe("Longitude of the location"),
    })
  }
)

const webSearchTool = tool(
  async ({ query }) => {
    try {
      console.log(`[Agent 3: Tool] Web searching for: ${query}`);
      const ddg = new DuckDuckGoSearch({ maxResults: 3 });
      const result = await ddg.invoke(query);
      if (!result || result.includes('anomaly') || result.includes('Error:')) {
        console.warn(`[Agent 3: Tool] DDG search returned an anomaly or error, skipping...`);
        return 'No recent relevant local news found for this query (API rate limit).';
      }
      return result;
    } catch (err) {
      console.warn(`[Agent 3: Tool] Web search failed.`, err);
      return 'No recent relevant local news found for this query (API rate limit).';
    }
  },
  {
    name: "web_search",
    description: "Searches the web for recent local news or events. Use this to verify incidents.",
    schema: z.object({
      query: z.string().describe("The search query")
    })
  }
)

export async function runValidationAgent(state: AgentState): Promise<AgentState> {
  console.log(`[Agent 3: Validator] Starting ReAct credibility validation for issue: ${state.issueId || state.reportId || 'unknown'}`);
  try {
    const llm = getChatModel(false) // use Flash/standard model
    
    // Tools array
    const tools = [getWeatherTool, webSearchTool]
    
    // Create the ReAct agent
    const agent = createReactAgent({ llm, tools })

    const promptText = `
Report: "${state.englishTranslation || state.rawText}"
Visual Evidence Analysis: ${state.imageAnalysis || 'No image provided'}
Category: ${state.classification?.category || 'unknown'}
Severity claimed: ${state.classification?.severity || 5}/10
Location: ${state.address || 'Unknown'} (Lat: ${state.coordinates?.lat}, Lng: ${state.coordinates?.lng})
Time of report: Just now
`
    
    console.log(`[Agent 3: Validator] Invoking ReAct agent loop with Prompt:\n${promptText}`);
    const result = await agent.invoke({
      messages: [
        { role: 'system', content: VALIDATION_SYSTEM },
        { role: 'user', content: promptText }
      ]
    });
    
    console.log(`\n============== [Agent 3: Validator Trace] ==============`);
    result.messages.forEach((msg: any, i: number) => {
      const type = msg._getType();
      console.log(`\n--- Step ${i + 1} (${type}) ---`);
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        console.log(`🔧 Tool Call(s):`, JSON.stringify(msg.tool_calls, null, 2));
      }
      if (type === 'tool') {
        console.log(`✅ Tool Response [${msg.name}]:`, typeof msg.content === 'string' ? msg.content.substring(0, 500) : msg.content);
      } else if (msg.content) {
        console.log(`💬 Content:`, typeof msg.content === 'string' ? msg.content.substring(0, 500) : msg.content);
      }
    });
    console.log(`========================================================\n`);

    // Instead of relying on the final message (which might be a tool response if the LLM halts),
    // we feed the ENTIRE reasoning trace into the JSON synthesizer. This makes it 100% robust
    // even with local LLMs that hallucinate tool calls or exit early.
    const conversationHistory = result.messages
      .map((m: any) => `${m._getType().toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n\n');

    // Track which tools were actually called by examining the trace
    let weatherChecked = false;
    let webSearchChecked = false;
    
    result.messages.forEach((msg: any) => {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach((tc: any) => {
          if (tc.name === 'get_weather_data') weatherChecked = true;
          if (tc.name === 'web_search' || tc.name === 'duckduckgo-search') webSearchChecked = true;
        });
      }
    });

    console.log(`[Agent 3: Validator] Synthesizing final JSON from full trace...`);
    let validation: ValidationResult;
    try {
      const extractPrompt = `Based on the following reasoning trace and tool outputs, determine the final credibility assessment:\n\n${conversationHistory}`;
      validation = await generateStructuredJSON<ValidationResult>(extractPrompt, VALIDATION_SYSTEM);
    } catch (parseError) {
      console.warn(`[Agent 3: Validator] Failed to parse correct schema even after formatting step. Fallback triggered.`);
      validation = {
        credibility_score: 5,
        reasoning: 'Model failed to validate structure. Defaulting to community review.',
        needs_community_verification: true,
        weather_corroborated: false
      };
    }

    const supabase = createServiceClient()
    
    console.log(`[Agent 3: Validator] Advancing pipeline stage and updating credibility score...`);
    const isCommunityReview = validation.needs_community_verification;
    const { error: updateError } = await supabase.from('issues').update({
      credibility_score: validation.credibility_score,
      needs_community_verification: validation.needs_community_verification,
      reasoning: validation.reasoning,
      weather_checked: weatherChecked,
      web_search_checked: webSearchChecked,
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
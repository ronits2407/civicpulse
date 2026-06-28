import { generateStructuredJSON } from '@/lib/ai/client'
import { AgentState } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'

const TRANSLATION_SYSTEM = `You are a highly efficient language detection and translation agent for a civic issue reporting platform in India.
Your task is to detect the language of the citizen's report and translate it to English if it is not already in English.
If it is in English, simply output 'English' and the original text.

Return valid JSON exactly matching this format:
{
  "thought_process": "string (Briefly explain how you identified the language and your translation approach)",
  "detected_language": "string (e.g., 'English', 'Hindi', 'Marathi', 'Tamil')",
  "translated_text": "string (The English translation. If already English, return the original text.)"
}
`

export async function runTranslationAgent(state: AgentState): Promise<AgentState> {
  console.log(`\n======================================================`);
  console.log(`[Agent 0: Translation] STARTING`);
  console.log(`[Agent 0: Translation] Processing issue ID: ${state.reportId || 'unknown'}`);
  console.log(`[Agent 0: Translation] Raw Input Received:\n"${state.rawText}"`);
  console.log(`======================================================\n`);

  try {
    const prompt = `Analyze this citizen report:\n"${state.rawText}"`

    const result = await generateStructuredJSON<{
      thought_process: string
      detected_language: string
      translated_text: string
    }>(prompt, TRANSLATION_SYSTEM)

    console.log(`\n[Agent 0: Translation] --- RESULTS ---`);
    console.log(`[Agent 0: Translation] Thinking: ${result.thought_process}`);
    console.log(`[Agent 0: Translation] Detected language: ${result.detected_language}`);
    console.log(`[Agent 0: Translation] Translated Text: "${result.translated_text}"`);
    console.log(`[Agent 0: Translation] -----------------------\n`);

    const translationTrace = `Detected ${result.detected_language}. ${result.thought_process}`

    const supabase = createServiceClient();
    
    // Update the issue with the detected language and trace
    const { error: updateError } = await supabase.from('issues').update({
      original_language: result.detected_language,
      translation_trace: translationTrace,
      pipeline_stage: 'agent1_classifier' // Move to next stage successfully
    }).eq('id', state.reportId)

    if (updateError) {
       console.error(`[Agent 0: Translation] Database update failed:`, updateError);
    }

    return {
      ...state,
      originalLanguage: result.detected_language,
      englishTranslation: result.translated_text,
      translationTrace
    }
  } catch (error: any) {
    console.error(`\n[Agent 0: Translation] ❌ FATAL ERROR:`, error);
    try {
      const supabase = createServiceClient();
      await supabase.from('issues').update({ pipeline_stage: 'agent0_translation_failed' }).eq('id', state.reportId);
    } catch (e) {
      console.error(`[Agent 0: Translation] Failed to update pipeline_stage to failed:`, e);
    }
    return {
      ...state,
      error: `Translation agent failed: ${error.message}`,
    }
  }
}

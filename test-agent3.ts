import { runValidationAgent } from './lib/agents/agent3-validation';
import { AgentState } from './lib/db/types';

async function test() {
  const fakeState: AgentState = {
    reportId: '123e4567-e89b-12d3-a456-426614174000', // valid UUID
    issueId: '123e4567-e89b-12d3-a456-426614174000',
    rawText: 'There is a huge pothole outside my house filled with rainwater.',
    coordinates: { lat: 20.0, lng: 73.78 },
    classification: {
      category: 'Infrastructure',
      subcategory: 'Road Damage',
      severity: 8,
      is_emergency: false,
      suggested_title: 'Pothole'
    },
    pipeline_stage: 'agent2_deduplication',
    imageAnalysis: null,
    duplicates: []
  };

  try {
    console.log('Testing Agent 3...');
    const result = await runValidationAgent(fakeState);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Test failed:', e);
  }
}

test();

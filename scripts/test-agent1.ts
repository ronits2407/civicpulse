import { runClassifierAgent } from '../lib/agents/agent1-classifier';
import { AgentState } from '../lib/db/types';

async function testAgent1() {
  const initialState: AgentState = {
    issueId: 'test-issue-123',
    rawText: 'There is a massive pothole on MG Road near the main junction causing major traffic and damage to cars. It is quite dangerous.',
    imageUrl: null,
  };

  console.log('Testing Agent 1 (Classifier)...');
  console.log('Input State:', JSON.stringify(initialState, null, 2));
  
  const finalState = await runClassifierAgent(initialState);
  
  console.log('\n--- Final Output ---');
  console.log(JSON.stringify(finalState, null, 2));
}

testAgent1().catch(console.error);

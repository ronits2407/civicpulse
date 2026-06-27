import { runValidationAgent } from '../lib/agents/agent3-validation';
import { AgentState } from '../lib/db/types';

async function testAgent3() {
  const initialState: any = {
    reportId: 'test-real-issue-id',
    rawText: 'There is severe waterlogging and a fallen tree blocking the entire road after the storm.',
    imageUrl: null,
    coordinates: { lat: 19.452757, lng: 74.66477, address: 'Near my home' },
    userId: 'test-user-id',
    classification: {
      category: 'infrastructure',
      subcategory: 'waterlogging',
      severity: 8,
      is_emergency: true,
      suggested_title: 'Severe Waterlogging and Fallen Tree',
      department_id: null
    },
    deduplication: {
      is_duplicate: false,
      cluster_id: null,
      existing_issue_id: null,
      similarity_score: 0,
    validation: null,
    resolution: null,
    error: null,
  };
  console.log('Testing Agent 3: Validator');
  const result = await runValidationAgent(initialState as any);
  console.log('Final State Output:', JSON.stringify(result.validation, null, 2));
}
testAgent3().catch(console.error);

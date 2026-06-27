import { runResolutionAgent } from '../lib/agents/agent4-resolution';
import { AgentState } from '../lib/db/types';

async function testAgent4() {
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
    validation: {
      credibility_score: 8,
      reasoning: 'Reported issue consistent with current weather and contains specific details. Severity claim is proportionate to description.',
      needs_community_verification: false,
      weather_corroborated: true
    resolution: null,
    error: null,
  };
  console.log('Testing Agent 4: Resolution Planner');
  const result = await runResolutionAgent(initialState as any);
  console.log('Final State Output:', JSON.stringify(result.resolution, null, 2));
}
testAgent4().catch(console.error);

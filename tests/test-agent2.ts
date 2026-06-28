import { runDeduplicationAgent } from '../lib/agents/agent2-deduplication';
import { AgentState } from '../lib/db/types';

async function testAgent2() {
  const initialState: any = {
    reportId: 'test-real-issue-id',
    rawText: 'Huge crater on the road here, it is completely unrelated text to the original', // Completely different text -> embedding similarity drops -> triggers proximity match
    imageUrl: null,
    coordinates: { lat: 19.452757, lng: 74.66477, address: 'Near my home' },
    userId: 'test-user-id',
    classification: {
      category: 'infrastructure', // using a real category
      subcategory: 'general',
      severity: 5,
      is_emergency: false,
      suggested_title: 'Huge crater on the road',
      department_id: null
    },
    deduplication: null,
    validation: null,
    resolution: null,
    error: null,
  };
  console.log('Testing Agent 2: Deduplicator with real data coordinates and DIFFERENT text (proximity trigger)');
  const result = await runDeduplicationAgent(initialState as any);
  console.log('Final State Output:', JSON.stringify(result.deduplication, null, 2));
}
testAgent2().catch(console.error);

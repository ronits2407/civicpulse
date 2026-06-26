import { createIssuePipeline } from './lib/agents/pipeline';

async function main() {
  console.log("Creating pipeline...");
  const pipeline = await createIssuePipeline();
  
  const initialState = {
    reportId: '9d0e453c-d6ec-4aeb-b644-e5095cbe3df1',
    rawText: 'this is what my scootie fell into',
    imageUrl: '',
    coordinates: { lat: 19.452757, lng: 74.66476999999999, address: 'test' },
    userId: 'test-user',
    classification: null,
    deduplication: null,
    validation: null,
    resolution: null,
    error: null,
  };

  console.log("Invoking pipeline...");
  const finalState = await pipeline.invoke(initialState);
  console.log(JSON.stringify(finalState, null, 2));
}

main().catch(console.error);

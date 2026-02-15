import { withApiLogging } from '@/lib/apiLogger';
import { runSearchPipeline } from '@/lib/searchService';
import { kvIncr } from '@/lib/kv';

export const POST = withApiLogging('search', async (payload) => {
  const result = await runSearchPipeline(payload);
  // Increment total search counter (fire-and-forget)
  kvIncr('total_searches').catch(err => console.error('Failed to increment search counter:', err));
  return result;
});

import { withApiLogging } from '@/lib/apiLogger';
import { runSearchPipeline } from '@/lib/searchService';
import { kvIncr } from '@/lib/kv';

export const POST = withApiLogging('search', async (payload) => {
  const result = await runSearchPipeline(payload);
  // Increment social-proof counter only for successful searches.
  if (result?.status === 200) {
    kvIncr('total_searches').catch(err => console.error('Failed to increment search counter:', err));
  }
  return result;
});

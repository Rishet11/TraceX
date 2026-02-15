import { withApiLogging } from '@/lib/apiLogger';
import { runSearchPipeline } from '@/lib/searchService';

export const POST = withApiLogging('search', async (payload) => {
  return await runSearchPipeline(payload);
});

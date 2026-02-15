import { withApiLogging } from '@/lib/apiLogger';
import { runAnalyzePipeline } from '@/lib/analyzeService';

export const POST = withApiLogging('analyze', async (payload) => {
  return await runAnalyzePipeline(payload);
});

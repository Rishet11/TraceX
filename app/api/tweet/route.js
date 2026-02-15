import { withApiLogging } from '@/lib/apiLogger';
import { runTweetFetchPipeline } from '@/lib/tweetFetchService';

export const POST = withApiLogging('tweet', async (payload) => {
  return await runTweetFetchPipeline(payload);
});

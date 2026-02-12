import { getTweetById } from './nitter.js';

function extractTweetId(url) {
  const match = String(url || '').match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function isUnavailableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('returned 403') ||
    message.includes('returned 404') ||
    message.includes('syndication returned 404') ||
    message.includes('oembed returned 404') ||
    message.includes('not found')
  );
}

export async function runTweetFetchPipeline(payload = {}, deps = {}) {
  const getTweetByIdFn = deps.getTweetByIdFn || getTweetById;
  const url = payload?.url;

  if (!url) {
    return { status: 400, body: { error: 'URL is required' } };
  }

  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return { status: 400, body: { error: 'Invalid Tweet URL' } };
  }

  try {
    const tweet = await getTweetByIdFn(tweetId);
    return { status: 200, body: { tweet, tweetId } };
  } catch (error) {
    if (isUnavailableError(error)) {
      return {
        status: 200,
        body: {
          tweet: null,
          tweetId,
          unavailable: true,
          reason: 'tweet_unavailable',
          message:
            'Could not fetch this tweet automatically (it may be deleted, protected, or temporarily blocked). Paste the tweet text directly.',
        },
      };
    }

    return {
      status: 500,
      body: {
        error: 'Failed to fetch tweet',
        details: error?.message || 'Unknown error',
      },
    };
  }
}

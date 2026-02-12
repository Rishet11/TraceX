import * as cheerio from 'cheerio';

async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'curl/8.7.1',
        Accept: 'application/json,text/plain,*/*',
      },
      referrerPolicy: 'no-referrer',
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function fetchSyndicationTweetById(tweetId, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 5000;
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    throw new Error(`Syndication returned ${response.status}`);
  }

  const data = await response.json();
  const username = String(
    data?.user?.screen_name ||
      data?.screen_name ||
      ''
  ).replace(/^@+/, '');
  const author = normalizeText(data?.user?.name || data?.name || username);
  const content = normalizeText(data?.text || data?.full_text || '');

  if (!content || !username) {
    throw new Error('Syndication payload missing tweet content');
  }

  return {
    content,
    author,
    username: `@${username}`,
    date: data?.created_at || 'Unknown',
    relativeDate: 'Recently found',
    url: `https://x.com/${username}/status/${tweetId}`,
    stats: {
      replies: Number(data?.reply_count ?? data?.conversation_count) || 0,
      retweets: Number(data?.retweet_count) || 0,
      likes: Number(data?.favorite_count) || 0,
    },
    avatar: data?.user?.profile_image_url_https || null,
    source: 'syndication',
  };
}

function stripHtmlToText(html) {
  const $ = cheerio.load(`<div>${html || ''}</div>`);
  return normalizeText($('div').text());
}

export async function fetchOEmbedTweetById(tweetId, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 5000;
  const url = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(
    `https://x.com/i/status/${tweetId}`
  )}`;
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    throw new Error(`oEmbed returned ${response.status}`);
  }

  const data = await response.json();
  const content = stripHtmlToText(data?.html || '');
  const author = normalizeText(data?.author_name || '');
  const authorUrl = String(data?.author_url || '');
  const usernameMatch = authorUrl.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
  const username = (usernameMatch?.[1] || '').replace(/^@+/, '');

  if (!content || !username) {
    throw new Error('oEmbed payload missing tweet content');
  }

  return {
    content,
    author: author || username,
    username: `@${username}`,
    date: 'Unknown',
    relativeDate: 'Recently found',
    url: `https://x.com/${username}/status/${tweetId}`,
    stats: {
      replies: 0,
      retweets: 0,
      likes: 0,
    },
    avatar: null,
    source: 'oembed',
  };
}

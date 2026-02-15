import * as cheerio from 'cheerio';
import { fetchWithTimeout, UA_CURL } from './httpClient.js';

const SYNDICATION_FETCH_OPTIONS = {
  headers: {
    'User-Agent': UA_CURL,
    Accept: 'application/json,text/plain,*/*',
  },
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseNumeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchSyndicationTweetById(tweetId, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 5000;
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;
  const response = await fetchWithTimeout(url, SYNDICATION_FETCH_OPTIONS, timeoutMs);
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
      replies: parseNumeric(data?.reply_count ?? data?.conversation_count),
      retweets: parseNumeric(data?.retweet_count),
      likes: parseNumeric(data?.favorite_count),
      views: parseNumeric(data?.view_count ?? data?.views?.count ?? data?.views),
      bookmarks: parseNumeric(data?.bookmark_count),
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
  const response = await fetchWithTimeout(url, SYNDICATION_FETCH_OPTIONS, timeoutMs);
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
      views: 0,
      bookmarks: 0,
    },
    avatar: null,
    source: 'oembed',
  };
}

function extractContentFromJinaText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.replace(/^>\s*/, '').trim())
    .filter(Boolean);

  const blockedPrefixes = [
    'title:',
    'url source:',
    'markdown content:',
    'warning:',
    'published time:',
    'author:',
    'description:',
  ];

  return (
    lines.find((line) => {
      const lower = line.toLowerCase();
      if (blockedPrefixes.some((prefix) => lower.startsWith(prefix))) return false;
      if (/^https?:\/\//i.test(line)) return false;
      if (line.includes('/status/')) return false;
      return line.length >= 20;
    }) || ''
  );
}

export async function fetchJinaStatusTweetById(tweetId, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 6000;
  const url = `https://r.jina.ai/http://x.com/i/status/${tweetId}`;
  const response = await fetchWithTimeout(url, SYNDICATION_FETCH_OPTIONS, timeoutMs);
  if (!response.ok) {
    throw new Error(`Jina status mirror returned ${response.status}`);
  }

  const text = await response.text();
  const content = normalizeText(extractContentFromJinaText(text));
  if (!content) {
    throw new Error('Jina status mirror payload missing tweet content');
  }

  const usernameMatches = Array.from(
    text.matchAll(new RegExp(`https?:\\/\\/(?:x|twitter)\\.com\\/([A-Za-z0-9_]+)\\/status\\/${tweetId}`, 'gi'))
  )
    .map((match) => String(match?.[1] || '').replace(/^@+/, '').toLowerCase())
    .filter(Boolean);
  const username = usernameMatches.find((value) => value !== 'i') || 'unknown';

  return {
    content,
    author: username,
    username: `@${username}`,
    date: 'Unknown',
    relativeDate: 'Recently found',
    url: `https://x.com/${username}/status/${tweetId}`,
    stats: {
      replies: 0,
      retweets: 0,
      likes: 0,
      views: 0,
      bookmarks: 0,
    },
    avatar: null,
    source: 'jina_status',
  };
}

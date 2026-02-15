import * as cheerio from 'cheerio';
import { logSearchDebug } from './logger.js';
import { fetchWithTimeout, UA_BROWSER } from './httpClient.js';

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

const DDG_FETCH_OPTIONS = {
  headers: {
    'User-Agent': UA_BROWSER,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  },
};

export function parseCountToken(value) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const unit = cleaned.slice(-1).toUpperCase();
  const numberPart = Number.parseFloat(unit.match(/[KMB]/) ? cleaned.slice(0, -1) : cleaned);
  if (!Number.isFinite(numberPart)) return 0;
  if (unit === 'K') return Math.round(numberPart * 1000);
  if (unit === 'M') return Math.round(numberPart * 1000000);
  if (unit === 'B') return Math.round(numberPart * 1000000000);
  return Math.round(numberPart);
}

export function extractStatsFromSnippet(snippet) {
  const stats = { replies: 0, retweets: 0, likes: 0, views: 0, bookmarks: 0 };
  const pattern = /(\d[\d.,]*\s*[KMB]?)\s*(Replies?|Retweets?|Likes?)/gi;
  const quotePattern = /(\d[\d.,]*\s*[KMB]?)\s*(Quote Tweets?|Quotes?)/gi;
  const metaPattern = /(\d[\d.,]*\s*[KMB]?)\s*(Views?|Bookmarks?)/gi;
  let match;
  while ((match = pattern.exec(snippet)) !== null) {
    const value = parseCountToken(match[1]);
    const label = match[2].toLowerCase();
    if (label.startsWith('repl')) stats.replies = Math.max(stats.replies, value);
    if (label.startsWith('retw')) stats.retweets = Math.max(stats.retweets, value);
    if (label.startsWith('like')) stats.likes = Math.max(stats.likes, value);
  }
  while ((match = quotePattern.exec(snippet)) !== null) {
    const value = parseCountToken(match[1]);
    stats.retweets = Math.max(stats.retweets, value);
  }
  while ((match = metaPattern.exec(snippet)) !== null) {
    const value = parseCountToken(match[1]);
    const label = match[2].toLowerCase();
    if (label.startsWith('view')) stats.views = Math.max(stats.views, value);
    if (label.startsWith('bookmark')) stats.bookmarks = Math.max(stats.bookmarks, value);
  }
  return stats;
}

export function cleanSnippetContent(snippet) {
  let text = String(snippet || '').replace(/\s+/g, ' ').trim();

  // Remove reply-context boilerplate that frequently appears in DDG snippets.
  text = text.replace(/\bReplying to @[\w_]+(?:\s+and\s+@[\w_]+)*/gi, '').trim();

  // Cut off trailing timeline metadata such as time/date/views/likes tails.
  const cutPatterns = [
    new RegExp(`\\b\\d{1,2}:\\d{2}\\s?(?:AM|PM)\\b.*$`, 'i'),
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b.*$`, 'i'),
    /\b\d[\d.,]*\s*[KMB]?\s*(?:Views|Retweets?|Likes?|Replies?|Quote Tweets?|Quotes?|Bookmarks?)\b.*$/i,
  ];
  for (const pattern of cutPatterns) {
    text = text.replace(pattern, '').trim();
  }

  return text;
}

export async function searchDuckDuckGo(query, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
  // Construct search query for Twitter specifically
  const searchTerm = `site:twitter.com "${query}"`;
  const encodedQuery = encodeURIComponent(searchTerm);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  logSearchDebug(`Searching DuckDuckGo for: ${searchTerm}`);

  try {
    const response = await fetchWithTimeout(url, DDG_FETCH_OPTIONS, timeoutMs);
    if (!response.ok) {
       throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    const html = await response.text();
    if (/anomaly-modal|Unfortunately, bots use DuckDuckGo too|challenge-form/i.test(html)) {
      throw new Error('DuckDuckGo returned anti-bot challenge page');
    }

    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((_, element) => {
        const $el = $(element);
        const title = $el.find('.result__title .result__a').text().trim();
        const snippet = $el.find('.result__snippet').text().trim();
        // Detailed URL is in the anchor href, often wrapped in ddg redirect
        const href = $el.find('.result__a').attr('href');
        
        if (!href) return;

        // Decode DDG redirect url
        // format: //duckduckgo.com/l/?uddg=...&rut=...
        let tweetUrl = href;
        if (href.includes('uddg=')) {
            const match = href.match(/uddg=([^&]+)/);
            if (match && match[1]) {
                tweetUrl = decodeURIComponent(match[1]);
            }
        }
        
        // Filter out non-tweet URLs (e.g. hashtags, profiles, lists)
        // Valid tweet URL: twitter.com/username/status/123456
        if (!tweetUrl.includes('/status/')) return;

        // Extract username and ID
        const urlParts = tweetUrl.match(/(?:twitter|x)\.com\/([^\/]+)\/status\/(\d+)/);
        if (!urlParts) return;

        const username = urlParts[1].replace(/^@+/, '');
        const tweetId = urlParts[2];

        // Clean up title to get "Full Name" if possible
        // Title format often: "Full Name (@username) on Twitter: ..." or similar
        // Or just "Tweet by Full Name"
        let fullname = username; 
        const titleMatch = title.match(/^(.+?)( \(@\w+\))? on Twitter/);
        if (titleMatch) {
            fullname = titleMatch[1].trim();
        }

        const stats = extractStatsFromSnippet(snippet);
        const cleanedContent = cleanSnippetContent(snippet);
        if (!cleanedContent) return;
        
        results.push({
            content: cleanedContent,
            author: {
                fullname,
                username,
                avatar: null // DDG doesn't give avatar easily
            },
            date: 'Unknown', // DDG snippet sometimes has date, tricky to parse reliably
            relativeDate: 'Recently found',
            url: tweetUrl.replace('twitter.com', 'x.com'),
            tweetId,
            stats,
            source: 'duckduckgo'
        });
    });

    if (results.length === 0) {
      throw new Error('DuckDuckGo returned no parseable tweet status results');
    }

    return { results, instance: 'DuckDuckGo' };

  } catch (error) {
    logSearchDebug('DuckDuckGo Search Error:', error?.message || error);
    throw error;
  }
}

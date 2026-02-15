import * as cheerio from 'cheerio';
import { cleanSnippetContent, extractStatsFromSnippet } from './duckduckgo.js';
import { fetchWithTimeout, UA_BROWSER } from './httpClient.js';

const BING_FETCH_OPTIONS = {
  headers: {
    'User-Agent': UA_BROWSER,
    Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
  },
};

function stripTracking(url) {
  return String(url || '').split('?')[0];
}

export async function searchBingRss(query, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
  const searchTerm = `site:x.com "${query}" status`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(searchTerm)}`;

  const response = await fetchWithTimeout(url, BING_FETCH_OPTIONS, timeoutMs);
  if (!response.ok) {
    throw new Error(`Bing RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const results = [];

  $('item').each((_, item) => {
    const title = $(item).find('title').text().trim();
    const description = $(item).find('description').text().trim();
    const link = stripTracking($(item).find('link').text().trim());
    if (!link.includes('/status/')) return;

    const match = link.match(/(?:x|twitter)\.com\/([^/\s]+)\/status\/(\d+)/i);
    if (!match) return;

    const username = match[1].replace(/^@+/, '');
    const tweetId = match[2];
    const content = cleanSnippetContent(description || title);
    if (!content) return;

    const stats = extractStatsFromSnippet(`${title} ${description}`);

    results.push({
      content,
      author: {
        fullname: username,
        username,
        avatar: null,
      },
      date: 'Unknown',
      relativeDate: 'Recently found',
      url: link.replace('twitter.com', 'x.com'),
      tweetId,
      stats,
      source: 'bing',
    });
  });

  if (results.length === 0) {
    throw new Error('Bing RSS returned no parseable tweet status results');
  }

  return { results, instance: 'Bing RSS' };
}

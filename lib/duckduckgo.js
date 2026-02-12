import * as cheerio from 'cheerio';

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers,
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function searchDuckDuckGo(query) {
  // Construct search query for Twitter specifically
  const searchTerm = `site:twitter.com "${query}"`;
  const encodedQuery = encodeURIComponent(searchTerm);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  console.log(`Searching DuckDuckGo for: ${searchTerm}`);

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
       throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((_, element) => {
        const $el = $(element);
        const title = $el.find('.result__title .result__a').text().trim();
        const snippet = $el.find('.result__snippet').text().trim();
        const rawUrl = $el.find('.result__url').text().trim(); // Display URL often truncated
        
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
        const urlParts = tweetUrl.match(/twitter\.com\/([^\/]+)\/status\/(\d+)/);
        if (!urlParts) return;

        const username = urlParts[1];
        // const tweetId = urlParts[2];

        // Clean up title to get "Full Name" if possible
        // Title format often: "Full Name (@username) on Twitter: ..." or similar
        // Or just "Tweet by Full Name"
        let fullname = username; 
        const titleMatch = title.match(/^(.+?)( \(@\w+\))? on Twitter/);
        if (titleMatch) {
            fullname = titleMatch[1].trim();
        }

        // Snippet often contains the tweet text 
        // We use snippet as the content. It might be truncated but better than nothing.
        
        results.push({
            content: snippet,
            author: {
                fullname,
                username,
                avatar: null // DDG doesn't give avatar easily
            },
            date: 'Unknown', // DDG snippet sometimes has date, tricky to parse reliably
            relativeDate: 'Recently found',
            url: tweetUrl.replace('twitter.com', 'x.com'),
            stats: {
                replies: 0,
                retweets: 0,
                likes: 0
            },
            source: 'duckduckgo'
        });
    });

    return { results, instance: 'DuckDuckGo' };

  } catch (error) {
    console.error('DuckDuckGo Search Error:', error);
    throw error;
  }
}

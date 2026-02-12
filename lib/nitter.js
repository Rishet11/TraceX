import * as cheerio from 'cheerio';

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.cz',
  'https://nitter.privacydev.net',
  'https://nitter.projectsegfau.lt',
  'https://nitter.eu.projectsegfau.lt',
  'https://nitter.soopy.moe',
  'https://nitter.kavin.rocks',
  'https://nitter.42l.fr',
  'https://nitter.pussthecat.org',
  'https://nitter.poast.org',
  'https://nitter.moomoo.me',
  'https://nitter.rawbit.ninja',
  'https://nitter.perennialte.ch',
  'https://nitter.freedit.eu',
];

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers,
      },
      referrerPolicy: 'no-referrer',
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function searchNitter(query) {
  const encodedQuery = encodeURIComponent(query);
  let lastError = null;

  // Shuffle instances to distribute load and avoid using the same down instance first every time
  const shuffledInstances = [...NITTER_INSTANCES].sort(() => Math.random() - 0.5);

  for (const instance of shuffledInstances) {
    try {
      const url = `${instance}/search?f=tweets&q=${encodedQuery}`;
      console.log(`Trying Nitter instance: ${instance}`);
      
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Instance returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const tweets = [];

      $('.timeline-item').each((_, element) => {
        // Skip pinned tweets if we want only strict search results, but usually search results don't have pinned tweets in the same way.
        // Also skip "No results found" message which might be in timeline-item on some instances? No, usually .timeline-none.
        
        const $el = $(element);
        
        // Check if it's a tweet (has tweet-content)
        const content = $el.find('.tweet-content').text().trim();
        if (!content) return;

        const fullname = $el.find('.fullname').text().trim();
        const username = $el.find('.username').text().trim();
        const date = $el.find('.tweet-date a').attr('title') || $el.find('.tweet-date').text().trim();
        const relativeDate = $el.find('.tweet-date').text().trim();
        const tweetLink = $el.find('.tweet-link').attr('href');
        
        // Avatar
        const avatar = $el.find('.avatar img').attr('src');
        // Handle relative avatar paths
        const fullAvatar = avatar ? (avatar.startsWith('http') ? avatar : `${instance}${avatar}`) : null;

        // Stats
        const stats = $el.find('.tweet-stats');
        const replies = parseStat(stats.find('.icon-comment').parent().text());
        const retweets = parseStat(stats.find('.icon-retweet').parent().text());
        const likes = parseStat(stats.find('.icon-heart').parent().text());

        tweets.push({
          content,
          author: {
            fullname,
            username,
            avatar: fullAvatar,
          },
          date,
          relativeDate,
          url: `https://x.com${tweetLink}`, // Convert back to X.com link
          stats: {
            replies,
            retweets,
            likes,
          },
        });
      });

      if (tweets.length === 0) {
          if ($('.timeline-none').length > 0) {
             return { results: [], instance };
          }
           // Neither tweets nor "no results" message found - likely an error page or structure change
           throw new Error('No tweets found and no empty state detected (possible rate limit or structure change)');
      }

      // If we got results, return
      return { results: tweets, instance };

    } catch (error) {
      console.error(`Error fetching from ${instance}:`, error.message);
      lastError = error;
      // Continue to next instance
    }
  }

  throw new Error(`All Nitter instances failed. Last error: ${lastError?.message}`);
}

export async function getTweetById(tweetId) {
  let lastError = null;
  const shuffledInstances = [...NITTER_INSTANCES].sort(() => Math.random() - 0.5);

  for (const instance of shuffledInstances) {
    try {
      const url = `${instance}/status/${tweetId}`;
      console.log(`Fetching tweet from: ${instance}`);
      
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Instance returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Main tweet in Nitter is usually the first main-tweet class or similar
      const $mainTweet = $('.main-tweet');
      
      if ($mainTweet.length > 0) {
          const content = $mainTweet.find('.tweet-content').text().trim();
          const author = $mainTweet.find('.fullname').text().trim();
          const username = $mainTweet.find('.username').text().trim();
          
          if (content) {
              return { content, author, username };
          }
      }
      
      throw new Error('Tweet content not found');

    } catch (error) {
      console.error(`Error fetching tweet from ${instance}:`, error.message);
      lastError = error;
    }
  }
   throw new Error(`All Nitter instances failed to fetch tweet. Last error: ${lastError?.message}`);
}


function parseStat(text) {
  if (!text) return 0;
  const trimmed = text.trim().replace(/,/g, ''); // Remove commas
  if (trimmed.endsWith('K')) {
    return parseFloat(trimmed) * 1000;
  }
  if (trimmed.endsWith('M')) {
    return parseFloat(trimmed) * 1000000;
  }
  return parseInt(trimmed, 10) || 0;
}

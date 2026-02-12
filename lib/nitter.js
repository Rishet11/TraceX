import * as cheerio from 'cheerio';

const DEFAULT_NITTER_INSTANCES = [
  // Prioritize currently reachable public instances first.
  'https://nitter.tiekoetter.com',
  'https://nitter.net',
  'https://nitter.poast.org',
];

const NITTER_INSTANCES = (process.env.NITTER_INSTANCES || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const ACTIVE_NITTER_INSTANCES =
  NITTER_INSTANCES.length > 0 ? NITTER_INSTANCES : DEFAULT_NITTER_INSTANCES;

const INSTANCE_HEALTH = new Map();
const HEALTH_SCORE_MIN = -8;
const HEALTH_SCORE_MAX = 8;
const INSTANCE_COOLDOWN_MS = Number(process.env.NITTER_INSTANCE_COOLDOWN_MS) || 90000;

function getInstanceState(instance) {
  if (!INSTANCE_HEALTH.has(instance)) {
    INSTANCE_HEALTH.set(instance, {
      score: 0,
      cooldownUntil: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
    });
  }
  return INSTANCE_HEALTH.get(instance);
}

function clampScore(value) {
  return Math.max(HEALTH_SCORE_MIN, Math.min(HEALTH_SCORE_MAX, value));
}

function getFailurePenalty(error) {
  const message = String(error?.message || '').toLowerCase();
  if (/anti-bot|challenge|403|429|rate limit/.test(message)) return 4;
  if (/timeout|aborted|fetch failed|enotfound|econn/.test(message)) return 3;
  return 2;
}

function recordInstanceSuccess(instance) {
  const state = getInstanceState(instance);
  state.score = clampScore(state.score + 2);
  state.cooldownUntil = 0;
  state.lastSuccessAt = Date.now();
}

function recordInstanceFailure(instance, error) {
  const state = getInstanceState(instance);
  const penalty = getFailurePenalty(error);
  state.score = clampScore(state.score - penalty);
  state.lastFailureAt = Date.now();

  // Cool down aggressive/blocked instances to prioritize healthy ones.
  if (state.score <= -2 || penalty >= 3) {
    const multiplier = state.score <= -5 ? 2 : 1;
    state.cooldownUntil = Date.now() + INSTANCE_COOLDOWN_MS * multiplier;
  }
}

function getPrioritizedInstances() {
  const now = Date.now();
  const instances = [...ACTIVE_NITTER_INSTANCES].map((instance) => ({
    instance,
    state: getInstanceState(instance),
  }));

  instances.sort((a, b) => {
    const aCooling = a.state.cooldownUntil > now;
    const bCooling = b.state.cooldownUntil > now;
    if (aCooling !== bCooling) return aCooling ? 1 : -1;
    if (a.state.score !== b.state.score) return b.state.score - a.state.score;
    return b.state.lastSuccessAt - a.state.lastSuccessAt;
  });

  const hasReady = instances.some((entry) => entry.state.cooldownUntil <= now);
  return { instances, hasReady };
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        // Some active Nitter instances gate browser-like UAs behind JS challenges.
        // A curl-like UA avoids those challenge pages and returns server-rendered HTML.
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.8',
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

function isBlockedOrChallengePage(html) {
  if (!html) return true;
  return /Just a moment|Enable JavaScript and cookies to continue|Making sure you're not a bot|Project Segfault Authentication|anubis/i.test(
    html
  );
}

export async function searchNitter(query, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
  const encodedQuery = encodeURIComponent(query);
  let lastError = null;
  const { instances, hasReady } = getPrioritizedInstances();

  for (const { instance, state } of instances) {
    if (hasReady && state.cooldownUntil > Date.now()) {
      continue;
    }

    try {
      const url = `${instance}/search?f=tweets&q=${encodedQuery}`;
      console.log(`Trying Nitter instance: ${instance}`);
      
      const response = await fetchWithTimeout(url, {}, timeoutMs);
      
      if (!response.ok) {
        throw new Error(`Instance returned ${response.status}`);
      }

      const html = await response.text();
      if (isBlockedOrChallengePage(html)) {
        throw new Error('Instance returned anti-bot or auth challenge page');
      }
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
        const isRetweet = $el.find('.retweet-header').length > 0;
        const isQuote = $el.find('.quote').length > 0 || $el.find('.quote-big').length > 0;
        
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
          isRetweet,
          isQuote,
        });
      });

      if (tweets.length === 0) {
          if ($('.timeline-none').length > 0) {
             recordInstanceSuccess(instance);
             return { results: [], instance };
          }
           // Neither tweets nor "no results" message found - likely an error page or structure change
           throw new Error('No tweets found and no empty state detected (possible rate limit or structure change)');
      }

      // If we got results, return
      recordInstanceSuccess(instance);
      return { results: tweets, instance };

    } catch (error) {
      console.error(`Error fetching from ${instance}:`, error.message);
      recordInstanceFailure(instance, error);
      lastError = error;
      // Continue to next instance
    }
  }

  throw new Error(`All Nitter instances failed. Last error: ${lastError?.message}`);
}

export async function getTweetById(tweetId) {
  const details = await getTweetDetailsById(tweetId);
  return {
    content: details.content,
    author: details.author,
    username: details.username,
  };
}

export async function getTweetDetailsById(tweetId, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
  let lastError = null;
  const { instances, hasReady } = getPrioritizedInstances();

  for (const { instance, state } of instances) {
    if (hasReady && state.cooldownUntil > Date.now()) {
      continue;
    }

    const candidateUrls = [`${instance}/i/status/${tweetId}`, `${instance}/status/${tweetId}`];
    let instanceLastError = null;

    for (const url of candidateUrls) {
      try {
        console.log(`Fetching tweet from: ${url}`);

        const response = await fetchWithTimeout(url, {}, timeoutMs);

        if (!response.ok) {
          throw new Error(`Instance returned ${response.status}`);
        }

        const html = await response.text();
        if (isBlockedOrChallengePage(html)) {
          throw new Error('Instance returned anti-bot or auth challenge page');
        }

        const $ = cheerio.load(html);
        const $mainTweet = $('.main-tweet');

        if ($mainTweet.length > 0) {
          const content = $mainTweet.find('.tweet-content').text().trim();
          const author = $mainTweet.find('.fullname').text().trim();
          const username = $mainTweet.find('.username').text().trim();
          const date = $mainTweet.find('.tweet-date a').attr('title') || $mainTweet.find('.tweet-date').text().trim();
          const relativeDate = $mainTweet.find('.tweet-date').text().trim();
          const avatar = $mainTweet.find('.avatar img').attr('src');
          const fullAvatar = avatar ? (avatar.startsWith('http') ? avatar : `${instance}${avatar}`) : null;
          const stats = $mainTweet.find('.tweet-stats');
          const replies = parseStat(stats.find('.icon-comment').parent().text());
          const retweets = parseStat(stats.find('.icon-retweet').parent().text());
          const likes = parseStat(stats.find('.icon-heart').parent().text());
          const cleanUsername = username.replace(/^@/, '');

          if (content) {
            recordInstanceSuccess(instance);
            return {
              content,
              author,
              username,
              date,
              relativeDate,
              url: `https://x.com/${cleanUsername}/status/${tweetId}`,
              stats: {
                replies,
                retweets,
                likes,
              },
              avatar: fullAvatar,
            };
          }
        }

        throw new Error('Tweet content not found');
      } catch (error) {
        console.error(`Error fetching tweet from ${url}:`, error.message);
        instanceLastError = error;
      }
    }

    if (instanceLastError) {
      recordInstanceFailure(instance, instanceLastError);
      lastError = instanceLastError;
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

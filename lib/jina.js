async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'curl/8.7.1',
        Accept: 'text/plain,*/*',
        ...options.headers,
      },
      referrerPolicy: 'no-referrer',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function buildContextSnippet(text, index, length) {
  const start = Math.max(0, index - 140);
  const end = Math.min(text.length, index + length + 140);
  return text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/gi, '')
    .trim();
}

export async function searchJinaMirror(query, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
  const searchUrl = `https://r.jina.ai/http://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;

  const response = await fetchWithTimeout(searchUrl, {}, timeoutMs);
  if (!response.ok) {
    throw new Error(`Jina mirror returned ${response.status}`);
  }

  const text = await response.text();
  const results = [];
  const seen = new Set();
  const regex = /https?:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const username = match[1];
    const tweetId = match[2];
    const key = `${username}:${tweetId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const context = buildContextSnippet(text, match.index, match[0].length);
    const content = context || query;

    results.push({
      content,
      author: {
        fullname: username,
        username,
        avatar: null,
      },
      date: 'Unknown',
      relativeDate: 'Recently found',
      url: `https://x.com/${username}/status/${tweetId}`,
      tweetId,
      stats: {
        replies: 0,
        retweets: 0,
        likes: 0,
      },
      source: 'jina',
    });
  }

  if (results.length === 0) {
    throw new Error('Jina mirror returned no parseable tweet status results');
  }

  return { results, instance: 'Jina Mirror' };
}

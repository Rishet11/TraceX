const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;
const WHITESPACE = /\s+/g;
const TRAILING_PUNCT_REPEAT = /([!?.,])\1{2,}$/g;
const STRIP_PUNCT = /[^\p{L}\p{N}\s@#]/gu;
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'then',
  'than',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'by',
  'is',
  'it',
  'this',
  'that',
  'these',
  'those',
  'be',
  'are',
  'was',
  'were',
  'as',
  'with',
  'from',
  'you',
  'your',
  'i',
  'we',
  'they',
  'he',
  'she',
  'them',
  'our',
  'us'
]);

export function normalizeSearchText(input) {
  const cleaned = String(input || '')
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(WHITESPACE, ' ')
    .trim();
  return cleaned.replace(TRAILING_PUNCT_REPEAT, '$1').trim();
}

function punctuationNormalized(text) {
  return normalizeSearchText(text)
    .replace(STRIP_PUNCT, '')
    .replace(WHITESPACE, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeSearchText(text)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
}

function isVariantUseful(raw) {
  const normalized = normalizeSearchText(raw);
  if (normalized.length < 8) return false;
  const tokenCount = normalized.split(' ').filter(Boolean).length;
  return tokenCount >= 3;
}

function buildCoreWindow(tokens) {
  if (tokens.length <= 16) return tokens.join(' ');
  const size = Math.min(16, Math.max(10, Math.floor(tokens.length * 0.6)));
  const start = Math.max(0, Math.floor((tokens.length - size) / 2));
  return tokens.slice(start, start + size).join(' ');
}

function buildKeywordFallback(tokens) {
  const unique = [];
  const seen = new Set();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (STOPWORDS.has(lower) && !lower.startsWith('#') && !lower.startsWith('@')) continue;
    unique.push(token);
    if (unique.length >= 8) break;
  }

  return unique.join(' ');
}

export function buildQueryVariants(input, options = {}) {
  const maxVariants = Math.min(Number(options.maxVariants) || 4, 4);
  const normalized = normalizeSearchText(input);
  const normalizedPunct = punctuationNormalized(input);
  const tokens = tokenize(normalizedPunct);
  const coreWindow = buildCoreWindow(tokens);
  const keywordFallback = buildKeywordFallback(tokens);

  const candidateVariants = [
    { key: 'exactQuoted', query: `"${normalized}"` },
    { key: 'normalizedQuoted', query: `"${normalizedPunct}"` },
    { key: 'coreWindowQuoted', query: `"${coreWindow}"` },
    { key: 'keywordFallback', query: keywordFallback }
  ];

  const deduped = [];
  const seenQuery = new Set();

  for (const variant of candidateVariants) {
    const plain = variant.query.replace(/^"|"$/g, '');
    if (!isVariantUseful(plain)) continue;
    const canonical = plain.toLowerCase();
    if (seenQuery.has(canonical)) continue;
    seenQuery.add(canonical);
    deduped.push({
      key: variant.key,
      query: variant.query,
      plain
    });
    if (deduped.length >= maxVariants) break;
  }

  return deduped;
}

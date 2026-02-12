function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEngagement(item) {
  if (Number.isFinite(Number(item?.engagement))) {
    return Number(item.engagement);
  }
  return (
    toNumber(item?.stats?.likes) +
    toNumber(item?.stats?.retweets) +
    toNumber(item?.stats?.replies)
  );
}

function getEngagementPercentile(engagement, sortedEngagements) {
  if (!sortedEngagements.length) return 0;
  const lastIndex = sortedEngagements.length - 1;
  if (lastIndex <= 0) return engagement > 0 ? 1 : 0;
  const firstAtOrAbove = sortedEngagements.findIndex((v) => v >= engagement);
  const rank = firstAtOrAbove === -1 ? lastIndex : firstAtOrAbove;
  return rank / lastIndex;
}

function isOriginalLike(item) {
  const content = String(item?.content || '').trim();
  const hasStatusUrl = /https?:\/\/(x|twitter)\.com\/[^/\s]+\/status\/\d+/i.test(content);
  const hasQuoteMarker = /\b(QT|QRT|quote tweet|quoted)\b/i.test(content);
  const isRetweetLike = item?.isRetweet === true || content.startsWith('RT @');
  const isQuoteLike = item?.isQuote === true || (hasStatusUrl && hasQuoteMarker);
  return !isRetweetLike && !isQuoteLike;
}

export function computeResultQualityScore(item, sortedEngagements = []) {
  const similarityScore = Math.max(0, Math.min(100, toNumber(item?.similarityScore)));
  const similarityComponent = (similarityScore / 100) * 60;

  const engagement = Math.max(0, getEngagement(item));
  const engagementPercentile = getEngagementPercentile(engagement, sortedEngagements);
  const engagementComponent = engagementPercentile * 20;

  const hasDate = Number.isFinite(Number(item?.parsedDate));
  const hasStats = engagement > 0;
  const hasRichSource = item?.source === 'nitter';
  const metadataComponent = (hasDate ? 4 : 0) + (hasStats ? 4 : 0) + (hasRichSource ? 2 : 0);

  const originalityComponent = isOriginalLike(item) ? 10 : 0;

  return Number((similarityComponent + engagementComponent + metadataComponent + originalityComponent).toFixed(2));
}

export function withQualityScores(items = []) {
  const engagements = items.map(getEngagement).sort((a, b) => a - b);
  return items.map((item) => ({
    ...item,
    qualityScore: computeResultQualityScore(item, engagements),
  }));
}


'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Filter, Share2, Sparkles } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import ResultCard from '@/components/ResultCard';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { calculateSimilarity } from '@/lib/similarity';
import { withQualityScores } from '@/lib/ranking';
import { encodeShareData } from '@/lib/urlEncoder';

const LOADING_MESSAGES = [
  'Searching for similar tweets...',
  'Checking multiple places for matches...',
  'Ranking the best results for you...',
];

const QUICK_EXAMPLES = [
  'just setting up my twttr',
  "name a career that ai can't replace",
  'build in public',
];

function parseMetricValue(value) {
  if (Number.isFinite(value)) return Number(value);
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return 0;
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return 0;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return 0;
  const unit = (match[2] || '').toUpperCase();
  if (unit === 'K') return Math.round(num * 1000);
  if (unit === 'M') return Math.round(num * 1000000);
  if (unit === 'B') return Math.round(num * 1000000000);
  return Math.round(num);
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle | loading | success | error
  const [searchMeta, setSearchMeta] = useState(null);
  const [lastSearchOptions, setLastSearchOptions] = useState({ queryInputType: 'text' });
  const [shareWarning, setShareWarning] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(80);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1300);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSearch = async (searchText, options = {}) => {
    const normalizedOptions = {
      queryInputType: options.queryInputType || 'text',
      excludeTweetId: options.excludeTweetId || null,
      excludeUsername: options.excludeUsername || null,
      excludeContent: options.excludeContent || null,
    };

    setLoading(true);
    setSearchStatus('loading');
    setQuery(searchText);
    setLastSearchOptions(normalizedOptions);
    setResults([]);
    setSearchMeta(null);
    setHideRetweets(normalizedOptions.queryInputType === 'url_text_extracted');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchText, ...normalizedOptions }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setSearchMeta(data.meta || null);
        setResults([]);
        setSearchStatus('error');
        return;
      }

      const resultsWithScores = (data.results || []).map((tweet) => {
        const engagement =
          parseMetricValue(tweet.stats?.likes) +
          parseMetricValue(tweet.stats?.retweets) +
          parseMetricValue(tweet.stats?.replies);
        const urlMatch = tweet.url?.match(/status\/(\d+)/);
        const parsedDateValue = Date.parse(tweet.date);
        const parsedDate = Number.isFinite(parsedDateValue) ? parsedDateValue : null;
        return {
          ...tweet,
          similarityScore: calculateSimilarity(searchText, tweet.content),
          engagement,
          parsedDate,
          tweetId: urlMatch ? urlMatch[1] : null,
        };
      });

      setResults(resultsWithScores);
      setSearchMeta(data.meta || null);
      setSearchStatus('success');
      setShareWarning('');
    } catch (error) {
      console.error('Unexpected search request error:', error);
      setResults([]);
      setSearchStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    let filtered = results.filter((r) => r.similarityScore >= similarityThreshold);
    if (hideRetweets) {
      filtered = filtered.filter((r) => {
        const content = String(r.content || '').trim();
        const isRetweetLike = r.isRetweet === true || content.startsWith('RT @');
        const hasStatusUrl = /https?:\/\/(x|twitter)\.com\/[^/\s]+\/status\/\d+/i.test(content);
        const hasQuoteMarker = /\b(QT|QRT|quote tweet|quoted)\b/i.test(content);
        const isQuoteLike = r.isQuote === true || (hasStatusUrl && hasQuoteMarker);
        return !isRetweetLike && !isQuoteLike;
      });
    }

    const engagements = filtered.map((r) => r.engagement ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(engagements.length / 2);
    const medianEngagement =
      engagements.length === 0
        ? 0
        : engagements.length % 2 === 0
          ? (engagements[mid - 1] + engagements[mid]) / 2
          : engagements[mid];
    const viralThreshold = medianEngagement > 0 ? medianEngagement * 10 : Infinity;

    const scored = withQualityScores(filtered);
    const sorted = [...scored].sort((a, b) => {
      if (sortBy === 'similarity') {
        if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
        if ((b.qualityScore || 0) !== (a.qualityScore || 0)) {
          return (b.qualityScore || 0) - (a.qualityScore || 0);
        }
        return (b.parsedDate ?? -Infinity) - (a.parsedDate ?? -Infinity);
      }
      if (sortBy === 'engagement') {
        const diff = (b.engagement || 0) - (a.engagement || 0);
        if (diff !== 0) return diff;
        if ((b.qualityScore || 0) !== (a.qualityScore || 0)) {
          return (b.qualityScore || 0) - (a.qualityScore || 0);
        }
        return b.similarityScore - a.similarityScore;
      }
      if (sortBy === 'oldest') {
        const aDate = a.parsedDate ?? Infinity;
        const bDate = b.parsedDate ?? Infinity;
        if (aDate !== bDate) return aDate - bDate;
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      }
      const aDate = a.parsedDate ?? -Infinity;
      const bDate = b.parsedDate ?? -Infinity;
      if (bDate !== aDate) return bDate - aDate;
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });

    const oldestTweet = sorted
      .filter((r) => r.parsedDate != null)
      .reduce((prev, curr) => {
        if (!prev) return curr;
        return (curr.parsedDate ?? Infinity) < (prev.parsedDate ?? Infinity) ? curr : prev;
      }, null);

    return {
      sorted,
      viralThreshold,
      oldestTweetId: oldestTweet?.tweetId || null,
    };
  }, [results, similarityThreshold, hideRetweets, sortBy]);

  const generateShareUrl = () => {
    const shareData = {
      q: query,
      r: processedData.sorted.map((r) => ({
        ...r,
        score: r.similarityScore,
      })),
    };
    const encoded = encodeShareData(shareData);
    if (!encoded) return;
    const url = `${window.location.origin}/results?data=${encoded}`;
    if (url.length > 2000) {
      setShareWarning('Too many results to share. Try filtering to reduce the payload.');
      return;
    }
    navigator.clipboard.writeText(url);
    setShareWarning('Share link copied to clipboard!');
  };

  const diagnosticsText = useMemo(() => {
    if (!searchMeta) return '';
    const tried = searchMeta?.variantsTried?.length || 0;
    if (!tried) return '';
    return `We tried ${tried} search variations to find matches.`;
  }, [searchMeta]);

  const sourceSummary = useMemo(() => {
    if (!searchMeta?.sources) return '';
    const available = [];
    const nitter = searchMeta.sources.nitter;
    const ddg = searchMeta.sources.duckduckgo;
    const bing = searchMeta.sources.bing;
    const jina = searchMeta.sources.jina;
    if (nitter?.attempts > nitter?.failures) available.push('search mirrors');
    if (ddg?.attempts > ddg?.failures) available.push('web discovery');
    if (bing?.attempts > bing?.failures) available.push('news index');
    if (jina?.attempts > jina?.failures) available.push('archive mirrors');
    if (available.length === 0) return '';
    return `Found via ${available.join(', ')}`;
  }, [searchMeta]);

  const showDebugPanel = process.env.NODE_ENV !== 'production' && searchMeta;
  const isDegradedSources = searchStatus === 'error' && searchMeta?.reason === 'all_sources_failed';
  const totalMatches = results.length;
  const visibleMatches = processedData.sorted.length;
  const isShareSuccess = shareWarning.toLowerCase().includes('copied');
  const searchModeLabel =
    lastSearchOptions?.queryInputType === 'url_text_extracted' ? 'URL mode' : 'Text mode';

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setSimilarityThreshold(80);
    setSortBy('date');
    setHideRetweets(false);
    setSearchStatus('idle');
    setSearchMeta(null);
    setShareWarning('');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 page-section">
        <div className="app-container space-y-6">
          <section className="surface-elevated px-6 py-8 md:p-10 text-center space-y-4">
            <div className="inline-flex items-center rounded-full bg-[var(--brand-50)] border border-[var(--brand-100)] px-3 py-1 text-xs font-semibold text-[var(--brand-600)] tracking-wide gap-1.5">
              <Sparkles size={14} />
              Protect your ideas from tweet copycats
            </div>
            <h1 className="text-hero text-slate-900">
              Find copied tweets in under a minute
            </h1>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Paste tweet text or URL, review ranked matches, and generate proof you can share.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-2 text-xs text-slate-600 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200">
                No signup required
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200">
                URL + text support
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200">
                AI verdict on demand
              </span>
            </div>
            <div className="flex justify-center gap-3 text-sm pt-1">
              <Link
                href="/pricing"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
              >
                View Pricing
              </Link>
              <Link
                href="/account"
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Account
              </Link>
            </div>
          </section>

          <SearchInput onSearch={handleSearch} isLoading={loading} />

          {searchStatus === 'idle' && (
            <>
              <section className="surface-card p-4 md:p-5 space-y-3">
                <div className="text-sm font-semibold text-slate-800">Try it now</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      onClick={() => handleSearch(example, { queryInputType: 'text' })}
                      className="text-sm px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="surface-card p-4">
                  <div className="text-sm font-semibold text-slate-900 mb-1">
                    1. Paste tweet text or URL
                  </div>
                  <p className="text-sm text-slate-600">Drop in the content you want to protect.</p>
                </div>
                <div className="surface-card p-4">
                  <div className="text-sm font-semibold text-slate-900 mb-1">
                    2. Review ranked matches
                  </div>
                  <p className="text-sm text-slate-600">Filter by similarity and spot likely copies.</p>
                </div>
                <div className="surface-card p-4">
                  <div className="text-sm font-semibold text-slate-900 mb-1">
                    3. Analyze and share proof
                  </div>
                  <p className="text-sm text-slate-600">Use AI verdict and shareable result links.</p>
                </div>
              </section>
            </>
          )}

          {searchStatus !== 'idle' && (
            <section className="space-y-6">
              {(searchStatus === 'success' || searchStatus === 'error') && query && (
                <div className="surface-card px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-gray-700">
                    <span className="font-semibold">Search:</span> “
                    {query.slice(0, 120)}
                    {query.length > 120 ? '...' : ''}”
                  </div>
                  <div className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium w-fit">
                    {searchModeLabel}
                  </div>
                </div>
              )}

              {searchStatus === 'loading' && (
                <div className="space-y-4">
                  <div className="surface-card p-6 text-center space-y-2">
                    <p className="text-gray-700 font-semibold">{LOADING_MESSAGES[loadingStep]}</p>
                    <p className="text-xs text-slate-500">This may take a few seconds.</p>
                    <div className="flex justify-center gap-1.5 pt-1">
                      {LOADING_MESSAGES.map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-2.5 w-2.5 rounded-full transition-all ${idx === loadingStep ? 'bg-[var(--brand-500)] scale-110' : 'bg-slate-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="surface-card p-5 animate-pulse">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200" />
                            <div className="space-y-2">
                              <div className="h-4 w-32 bg-slate-200 rounded" />
                              <div className="h-3 w-24 bg-slate-100 rounded" />
                            </div>
                          </div>
                          <div className="h-8 w-24 bg-slate-100 rounded-full" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 w-full bg-slate-100 rounded" />
                          <div className="h-4 w-11/12 bg-slate-100 rounded" />
                          <div className="h-4 w-9/12 bg-slate-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchStatus === 'success' && results.length > 0 && (
                <>
                  <div className="surface-card p-4 space-y-4 sticky top-20 z-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {visibleMatches} visible
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {totalMatches} total
                        </span>
                      </div>
                      {sourceSummary && <div className="text-xs text-gray-500">{sourceSummary}</div>}
                    </div>
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-3 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                          <Filter size={18} className="text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            Similarity: {similarityThreshold}%+
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={similarityThreshold}
                            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                            className="w-24 md:w-32 accent-blue-600"
                            aria-label="Similarity threshold"
                          />
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hideRetweets}
                              onChange={(e) => setHideRetweets(e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            Hide Retweets & Quotes
                          </label>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                          <ArrowDownUp size={16} className="text-gray-500" />
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 bg-white py-1"
                            aria-label="Sort results"
                          >
                            <option value="date">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="similarity">Highest Match</option>
                            <option value="engagement">Most Viral</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <button
                          onClick={generateShareUrl}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                        >
                          <Share2 size={16} /> Share Results
                        </button>
                        <button
                          onClick={resetSearch}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          Check another tweet
                        </button>
                      </div>
                    </div>
                    {shareWarning && (
                      <div
                        className={`text-xs rounded-lg px-3 py-2 border ${isShareSuccess ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}
                      >
                        {shareWarning}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {showDebugPanel && (
                      <div className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-3">
                        <div className="font-semibold text-slate-700 mb-1">Debug Diagnostics</div>
                        <div>Reason: {searchMeta.reason}</div>
                        <div>
                          Sources: Nitter {searchMeta?.sources?.nitter?.attempts || 0}/
                          {searchMeta?.sources?.nitter?.failures || 0} fail, DDG{' '}
                          {searchMeta?.sources?.duckduckgo?.attempts || 0}/
                          {searchMeta?.sources?.duckduckgo?.failures || 0} fail, Bing{' '}
                          {searchMeta?.sources?.bing?.attempts || 0}/
                          {searchMeta?.sources?.bing?.failures || 0} fail, Jina{' '}
                          {searchMeta?.sources?.jina?.attempts || 0}/
                          {searchMeta?.sources?.jina?.failures || 0} fail
                        </div>
                      </div>
                    )}
                    {processedData.sorted.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 surface-card">
                        <p>No results match your filters.</p>
                        <button
                          onClick={() => setSimilarityThreshold(80)}
                          className="mt-3 text-sm px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                        >
                          Reset similarity to 80%
                        </button>
                      </div>
                    ) : (
                      <>
                        {processedData.sorted.map((tweet, i) => {
                          const badges = [];
                          if (tweet.similarityScore === 100) badges.push('💯 EXACT MATCH');
                          if (
                            processedData.oldestTweetId &&
                            tweet.tweetId === processedData.oldestTweetId
                          ) {
                            badges.push('⭐ OLDEST');
                          }
                          if ((tweet.engagement || 0) >= processedData.viralThreshold) {
                            badges.push('🔥 VIRAL');
                          }

                          return (
                            <ResultCard
                              key={tweet.tweetId || i}
                              tweet={tweet}
                              originalText={query}
                              similarity={tweet.similarityScore}
                              badges={badges}
                            />
                          );
                        })}

                        <div className="surface-card p-4 text-sm text-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            Need unlimited checks and priority reliability?
                            <span className="font-semibold"> Upgrade when you are ready.</span>
                          </div>
                          <Link
                            href="/pricing"
                            className="inline-flex w-fit px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
                          >
                            Compare plans
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {searchStatus === 'success' && results.length === 0 && (
                <div className="surface-card p-8 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">No copies found</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    We could not find matching tweets for this query right now.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`"${query}"`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                    >
                      Try on X
                    </a>
                    <button
                      onClick={resetSearch}
                      className="inline-flex items-center px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                    >
                      Check another tweet
                    </button>
                  </div>
                  {diagnosticsText && <p className="text-xs text-gray-500 pt-1">{diagnosticsText}</p>}
                </div>
              )}

              {searchStatus === 'error' && (
                <div className="surface-card p-8 text-center space-y-4">
                  <div className="text-yellow-500 mx-auto w-12 h-12 flex items-center justify-center bg-yellow-50 rounded-full text-2xl">
                    ⚠️
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Search temporarily unavailable</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    {isDegradedSources
                      ? 'Search providers are currently busy. Try again in a few seconds.'
                      : 'We could not complete the search right now. Please retry or search directly on X.'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => handleSearch(query, lastSearchOptions)}
                      className="inline-flex items-center px-5 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                    >
                      Retry Search
                    </button>
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`"${query}"`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                    >
                      Search on X
                    </a>
                    <button
                      onClick={resetSearch}
                      className="inline-flex items-center px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Filter, Share2 } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import ResultCard from '@/components/ResultCard';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { calculateSimilarity } from '@/lib/similarity';
import { withQualityScores } from '@/lib/ranking';
import { encodeShareData } from '@/lib/urlEncoder';
import { trackEvent } from '@/lib/analytics';

const LOADING_MESSAGES = [
  'Finding copies... ⏱️ ~15 seconds',
  'Checking multiple sources...',
  'Ranking possible matches...',
];

const DEMO_MATCH_PREVIEW = {
  author: 'Maya Patel',
  handle: '@mayabuilds',
  content: 'Shipping in public works when you show receipts, not just claims.',
  score: 94,
  likes: '2.1K',
  retweets: '380',
  replies: '129',
  posted: '3h ago',
};

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
  const [selfDuplicates, setSelfDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [searchMeta, setSearchMeta] = useState(null);
  const [lastSearchOptions, setLastSearchOptions] = useState({ queryInputType: 'text' });
  const [shareWarning, setShareWarning] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(80);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const trackedResultQueryRef = useRef('');

  useEffect(() => {
    trackEvent('landing_viewed', { page: 'home' });
  }, []);

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
      sourceUrl: options.sourceUrl || null,
      excludeTweetId: options.excludeTweetId || null,
      excludeUsername: options.excludeUsername || null,
      excludeContent: options.excludeContent || null,
    };

    setLoading(true);
    setSearchStatus('loading');
    setQuery(searchText);
    setLastSearchOptions(normalizedOptions);
    setResults([]);
    setSelfDuplicates([]);
    setSearchMeta(null);
    setHideRetweets(normalizedOptions.queryInputType === 'url_text_extracted');
    trackedResultQueryRef.current = '';
    trackEvent('search_started', {
      queryLength: String(searchText || '').length,
      mode: normalizedOptions.queryInputType,
    });

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
        setSelfDuplicates([]);
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
      const selfDuplicatesWithScores = (data.selfDuplicates || []).map((tweet) => {
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
      setSelfDuplicates(selfDuplicatesWithScores);
      setSearchMeta(data.meta || null);
      setSearchStatus('success');
      setShareWarning('');
    } catch (error) {
      console.error('Unexpected search request error:', error);
      setResults([]);
      setSelfDuplicates([]);
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
    return `Confidence check: scanned ${tried} query variations across live sources.`;
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
  const isUrlModeSearch = lastSearchOptions?.queryInputType === 'url_text_extracted';
  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setSelfDuplicates([]);
    setSimilarityThreshold(80);
    setSortBy('date');
    setHideRetweets(false);
    setSearchStatus('idle');
    setSearchMeta(null);
    setShareWarning('');
    setShowFiltersMobile(false);
  };

  const focusSearchInput = () => {
    if (typeof document === 'undefined') return;
    const input = document.getElementById('tweet-query');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }
  };

  const broadenQueryText = (value) => {
    const cleaned = String(value || '').replace(/[^\w\s#@]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return value;
    const words = cleaned.split(' ').filter(Boolean);
    return words.slice(0, Math.min(10, words.length)).join(' ');
  };

  useEffect(() => {
    if (searchStatus !== 'success' || !query) return;
    if (trackedResultQueryRef.current === query) return;

    if (results.length > 0) {
      trackEvent('results_seen', { hasResults: true, totalResults: results.length });
    } else {
      trackEvent('results_seen', { hasResults: false, totalResults: 0 });
    }
    trackedResultQueryRef.current = query;
  }, [searchStatus, results.length, query]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <main className="flex-1 section-block">
        <div className="container-main">
          <section className="text-center space-y-3">
            <h1 className="display-xl max-w-3xl mx-auto">Find who copied your tweet</h1>
            <p className="text-ui max-w-2xl mx-auto">
              Paste a tweet URL or text and get proof in about 30 seconds.
            </p>
          </section>

          <section className="mt-4 md:mt-5">
            <SearchInput onSearch={handleSearch} isLoading={loading} />
          </section>

          <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
            No signup required. Public tweets only. Start free.
          </div>

          {searchStatus === 'idle' && (
            <>
              <section className="mt-7 surface p-5 md:p-6 space-y-3.5">
                <div>
                  <h2 className="heading-lg">See it in action</h2>
                  <p className="text-helper mt-1">Example result preview</p>
                </div>

                <div className="surface-soft p-4 md:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-[var(--text-title)]">{DEMO_MATCH_PREVIEW.author}</p>
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">{DEMO_MATCH_PREVIEW.handle}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <span className="chip">Example</span>
                      <span className="chip !bg-[var(--success-50)] !text-[var(--success-600)] !border-green-200">
                        {DEMO_MATCH_PREVIEW.score}% Match
                      </span>
                    </div>
                  </div>

                  <p className="text-ui">{DEMO_MATCH_PREVIEW.content}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                    <span>{DEMO_MATCH_PREVIEW.replies} replies</span>
                    <span>{DEMO_MATCH_PREVIEW.retweets} reposts</span>
                    <span>{DEMO_MATCH_PREVIEW.likes} likes</span>
                    <span>{DEMO_MATCH_PREVIEW.posted}</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {searchStatus !== 'idle' && (
            <section className="space-y-4 mt-7">
              {(searchStatus === 'success' || searchStatus === 'error') && query && (
                <div className="surface-soft px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  {isUrlModeSearch && lastSearchOptions?.sourceUrl ? (
                    <div className="text-sm text-[var(--text-body)] min-w-0">
                      <div className="min-w-0">
                        <span className="font-semibold">Source URL:</span>{' '}
                        <a
                          href={lastSearchOptions.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--brand-700)] hover:underline break-all"
                        >
                          {lastSearchOptions.sourceUrl}
                        </a>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Searching with text extracted from this tweet.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--text-body)]">
                      <span className="font-semibold">Search:</span> “{query.slice(0, 120)}
                      {query.length > 120 ? '...' : ''}”
                    </div>
                  )}
                </div>
              )}

              {searchStatus === 'loading' && (
                <div className="space-y-4">
                  <div className="surface p-5 text-center space-y-2.5">
                    <p className="text-[var(--text-title)] font-semibold">{LOADING_MESSAGES[loadingStep]}</p>
                    <p className="text-helper">Usually takes 5–15 seconds.</p>
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
                      <div key={item} className="surface p-5 animate-pulse">
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
                  <div className="surface-soft px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--text-title)]">
                      Search complete - found {visibleMatches} potential {visibleMatches === 1 ? 'match' : 'matches'}.
                    </p>
                  </div>
                  <div className="surface p-3 md:p-3.5 space-y-2.5 sticky top-[74px] z-20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="chip">{visibleMatches} visible</span>
                        <span className="chip">{totalMatches} total</span>
                      </div>
                      {sourceSummary && <div className="text-caption">{sourceSummary}</div>}
                    </div>

                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setShowFiltersMobile((prev) => !prev)}
                        className="btn btn-secondary inline-flex md:hidden px-3 py-2"
                      >
                        {showFiltersMobile ? 'Hide filters' : 'Show filters'}
                      </button>

                      <div className={`${showFiltersMobile ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 xl:flex gap-2.5 md:gap-3 w-full xl:w-auto`}>
                        <div className="surface-soft px-3 py-2 flex items-center gap-2">
                          <Filter size={17} className="text-[var(--text-muted)]" />
                          <span className="text-sm font-medium text-[var(--text-body)] whitespace-nowrap">
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

                        <div className="surface-soft px-3 py-2 flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-body)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hideRetweets}
                              onChange={(e) => setHideRetweets(e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            Hide retweets & quotes
                          </label>
                        </div>

                        <div className="surface-soft px-3 py-2 flex items-center gap-2">
                          <ArrowDownUp size={16} className="text-[var(--text-muted)]" />
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

                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center sm:justify-end">
                        <button onClick={generateShareUrl} className="btn btn-primary px-4 py-2">
                          <Share2 size={16} /> Share results
                        </button>
                        <button onClick={resetSearch} className="btn btn-secondary px-4 py-2">
                          Check another tweet
                        </button>
                      </div>
                    </div>

                    {shareWarning && (
                      <div
                        className={`text-xs rounded-[var(--radius-sm)] px-3 py-2 border ${isShareSuccess ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}
                      >
                        {shareWarning}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    {selfDuplicates.length > 0 && (
                      <div className="surface-soft p-4 space-y-2.5">
                        <p className="text-sm font-semibold text-[var(--text-title)]">
                          Repeated by original author ({selfDuplicates.length})
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          These tweets are very similar but posted by the same author, so they are not
                          counted as copied by others.
                        </p>
                        <div className="space-y-2">
                          {selfDuplicates.slice(0, 4).map((tweet, idx) => (
                            <div
                              key={tweet.tweetId || tweet.url || idx}
                              className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs text-[var(--text-title)] truncate">
                                  {tweet.content || 'Tweet'}
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                  {tweet.relativeDate || 'Recently found'}
                                </p>
                              </div>
                              <a
                                href={tweet.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary px-2.5 py-1.5 text-xs shrink-0"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {showDebugPanel && (
                      <div className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-[var(--radius-sm)] p-3">
                        <div className="font-semibold text-slate-700 mb-1">Debug diagnostics</div>
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
                      <div className="surface text-center py-10 text-[var(--text-muted)]">
                        <p>No results match your filters.</p>
                        <button
                          onClick={() => setSimilarityThreshold(80)}
                          className="btn btn-secondary mt-3 px-4 py-2 text-sm"
                        >
                          Reset similarity to 80%
                        </button>
                      </div>
                    ) : (
                      <>
                        {processedData.sorted.map((tweet, i) => {
                          const badges = [];
                          if (tweet.similarityScore === 100) badges.push('💯 EXACT MATCH');
                          if (processedData.oldestTweetId && tweet.tweetId === processedData.oldestTweetId) {
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

                        <div className="surface p-4 md:p-5 text-sm text-[var(--text-body)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            Need unlimited checks and stronger reliability?
                            <span className="font-semibold"> Upgrade when you are ready.</span>
                          </div>
                          <Link
                            href="/pricing"
                            className="btn btn-primary w-fit px-4 py-2"
                            onClick={() => trackEvent('pricing_clicked', { source: 'results_nudge' })}
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
                <div className="surface p-5 md:p-6 text-center space-y-3">
                  <h3 className="text-xl font-semibold text-[var(--text-title)]">
                    {selfDuplicates.length > 0
                      ? 'Good news - no external copies detected'
                      : 'Good news - no copies detected'}
                  </h3>
                  <p className="text-ui max-w-md mx-auto">
                    {selfDuplicates.length > 0
                      ? 'We found similar posts from the same author, and no copied tweets from other accounts.'
                      : 'Your search came back clean for this query right now.'}
                  </p>

                  {selfDuplicates.length > 0 && (
                    <div className="text-left max-w-lg mx-auto surface-soft p-3">
                      <p className="text-xs font-semibold text-[var(--text-title)] mb-1.5">
                        Repeated by original author ({selfDuplicates.length})
                      </p>
                      <div className="space-y-2">
                        {selfDuplicates.slice(0, 4).map((tweet, idx) => (
                          <div
                            key={tweet.tweetId || tweet.url || idx}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-[var(--text-title)] truncate">
                                {tweet.content || 'Tweet'}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                {tweet.relativeDate || 'Recently found'}
                              </p>
                            </div>
                            <a
                              href={tweet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary px-2.5 py-1.5 text-xs shrink-0"
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-left max-w-md mx-auto surface-soft p-3">
                    <p className="text-xs font-semibold text-[var(--text-title)] mb-1">
                      Want to double-check?
                    </p>
                    <ul className="text-xs text-[var(--text-muted)] list-disc pl-4 space-y-1">
                      <li>
                        {isUrlModeSearch
                          ? 'Try opening the source tweet on X and check live results.'
                          : 'Use broader wording instead of exact phrasing.'}
                      </li>
                      {!isUrlModeSearch && <li>Try with the original tweet URL.</li>}
                      <li>Retry after a few minutes for fresher indexing.</li>
                    </ul>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`"${query}"`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary px-5 py-2.5"
                    >
                      Try on X
                    </a>
                    {!isUrlModeSearch && (
                      <button
                        type="button"
                        onClick={() => handleSearch(broadenQueryText(query), { queryInputType: 'text' })}
                        className="btn btn-secondary px-5 py-2.5"
                      >
                        Try broader wording
                      </button>
                    )}
                    {!isUrlModeSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          resetSearch();
                          setTimeout(() => focusSearchInput(), 0);
                        }}
                        className="btn btn-secondary px-5 py-2.5"
                      >
                        Try with tweet URL
                      </button>
                    )}
                    <button onClick={resetSearch} className="btn btn-ghost px-5 py-2.5">
                      Check another tweet
                    </button>
                  </div>

                  {diagnosticsText && <p className="text-caption pt-1">{diagnosticsText}</p>}
                </div>
              )}

              {searchStatus === 'error' && (
                <div className="surface p-5 md:p-6 text-center space-y-3.5">
                  <div className="text-amber-700 mx-auto w-12 h-12 flex items-center justify-center bg-amber-50 rounded-full text-2xl">
                    😕
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--text-title)]">Search is busy right now</h3>
                  <p className="text-ui max-w-md mx-auto">
                    {isDegradedSources
                      ? 'Search providers are currently busy. Try again in a few seconds.'
                      : 'We could not complete the search right now. Please retry or search directly on X.'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button onClick={() => handleSearch(query, lastSearchOptions)} className="btn btn-primary px-5 py-2.5">
                      Retry search
                    </button>
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`"${query}"`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost px-3 py-2"
                    >
                      Search on X instead
                    </a>
                    <button onClick={resetSearch} className="btn btn-ghost px-3 py-2">
                      Start over
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

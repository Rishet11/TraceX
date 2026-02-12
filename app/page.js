'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowDownUp, CheckCircle2, Filter, SearchCheck, Share2, Sparkles } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import ResultCard from '@/components/ResultCard';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { calculateSimilarity } from '@/lib/similarity';
import { withQualityScores } from '@/lib/ranking';
import { encodeShareData } from '@/lib/urlEncoder';
import { trackEvent } from '@/lib/analytics';

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

const DEMO_MATCH_PREVIEW = {
  author: 'Creator Alpha',
  handle: '@creatoralpha',
  content: 'Your strongest ideas deserve proof when they get copied.',
  score: 94,
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
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle | loading | success | error
  const [searchMeta, setSearchMeta] = useState(null);
  const [lastSearchOptions, setLastSearchOptions] = useState({ queryInputType: 'text' });
  const [shareWarning, setShareWarning] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(80);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [prefillText, setPrefillText] = useState('');
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
    setShowFiltersMobile(false);
    setPrefillText('');
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
      <main className="flex-1 page-section">
        <div className="app-container">
          <section className="surface-elevated px-5 py-6 md:px-8 md:py-8 text-center space-y-4">
            <div className="inline-flex items-center rounded-full bg-[var(--brand-50)] border border-[var(--brand-100)] px-3 py-1 text-xs font-semibold text-[var(--brand-600)] tracking-wide gap-1.5">
              <Sparkles size={14} />
              Protect your ideas from tweet copycats
            </div>
            <h1 className="text-hero text-slate-900">
              Find copied tweets in under a minute
            </h1>
            <p className="text-[18px] leading-relaxed text-[#4B5563] max-w-[600px] mx-auto">
              Paste tweet text or URL, review ranked matches, and generate proof you can share.
              <span className="block mt-1 text-[18px] font-semibold text-[#111827]">
                See likely copies in 30 seconds.
              </span>
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-3 text-sm text-[#374151] pt-2 font-medium">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={12} className="text-[#6B7280] shrink-0" />
                No signup required
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={12} className="text-[#6B7280] shrink-0" />
                URL + text support
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={12} className="text-[#6B7280] shrink-0" />
                AI verdict on demand
              </span>
            </div>
            <div className="flex justify-center gap-3 text-sm pt-2">
              <Link
                href="/pricing"
                className="text-[#2563EB] hover:text-[#1D4ED8] hover:underline underline-offset-2 font-semibold transition-colors duration-150 pb-0.5"
                onClick={() => trackEvent('pricing_clicked', { source: 'hero_link' })}
              >
                Explore pricing
              </Link>
            </div>
          </section>

          <div className="mt-10 md:mt-11">
            <SearchInput onSearch={handleSearch} isLoading={loading} prefillText={prefillText} />
          </div>

          {searchStatus === 'idle' && (
            <>
              <section className="mt-12 md:mt-14 surface-card p-5 md:p-6">
                <div className="text-lg font-semibold text-[#111827] mb-2">See it in action</div>
                <p className="text-sm text-[#6B7280] mb-4">Example result preview</p>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{DEMO_MATCH_PREVIEW.author}</div>
                      <div className="text-xs text-[#6B7280] mt-0.5">{DEMO_MATCH_PREVIEW.handle}</div>
                    </div>
                    <div className="text-right space-y-1.5">
                      <span className="inline-block text-xs font-medium text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] rounded px-3 py-1 tracking-wide">
                        Example
                      </span>
                      <span className="block px-2.5 py-1 rounded-md bg-[#D1FAE5] text-[#059669] border border-green-200/60 text-[11px] font-bold shadow-sm">
                        {DEMO_MATCH_PREVIEW.score}% Match
                      </span>
                    </div>
                  </div>
                  <p className="text-[15px] text-slate-800 leading-relaxed font-normal">
                    {DEMO_MATCH_PREVIEW.content}
                  </p>
                  <p className="text-sm text-[#6B7280] pt-1">
                    This is how your real results will look after search.
                  </p>
                </div>
              </section>

              <section className="mt-10 md:mt-12 surface-card p-5 md:p-6 space-y-4">
                <div className="text-lg font-semibold text-[#111827]">Try it now</div>
                <div className="flex flex-wrap gap-3">
                  {QUICK_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setPrefillText(example);
                        setTimeout(focusSearchInput, 50);
                      }}
                      className="text-sm px-4 py-2.5 rounded-full bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#EFF6FF] hover:border-[#3B82F6] active:bg-[#DBEAFE] active:border-[#2563EB] active:scale-[0.98] transition-all duration-200 ease-in cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-12 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                <div className="surface-card p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] h-full hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] transition-all duration-200">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6] mb-4">
                    <Sparkles size={24} />
                  </div>
                  <div className="text-base md:text-lg font-semibold text-[#111827] mb-2">
                    1. Paste tweet text or URL
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">Drop in the content you want to protect.</p>
                </div>
                <div className="surface-card p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] h-full hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] transition-all duration-200">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6] mb-4">
                    <SearchCheck size={24} />
                  </div>
                  <div className="text-base md:text-lg font-semibold text-[#111827] mb-2">
                    2. Review ranked matches
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">Filter by similarity and spot likely copies.</p>
                </div>
                <div className="surface-card p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] h-full hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] transition-all duration-200">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6] mb-4">
                    <Share2 size={24} />
                  </div>
                  <div className="text-base md:text-lg font-semibold text-[#111827] mb-2">
                    3. Analyze and share proof
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">Use AI verdict and shareable result links.</p>
                </div>
              </section>
            </>
          )}

          {searchStatus !== 'idle' && (
            <section className="space-y-5 md:space-y-6">
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
                    <p className="text-xs text-slate-500">
                      This may take a few seconds. Usually 5–15 seconds.
                    </p>
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
                  <div className="surface-card p-3.5 md:p-4 space-y-3 md:space-y-4 sticky top-20 z-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {visibleMatches} visible
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {totalMatches} total
                        </span>
                      </div>
                      {sourceSummary && <div className="text-xs text-slate-600">{sourceSummary}</div>}
                    </div>
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 md:gap-4">
                      <button
                        type="button"
                        onClick={() => setShowFiltersMobile((prev) => !prev)}
                        className="inline-flex md:hidden items-center justify-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium"
                      >
                        {showFiltersMobile ? 'Hide filters' : 'Show filters'}
                      </button>

                      <div
                        className={`${showFiltersMobile ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 xl:flex gap-2.5 md:gap-3 w-full xl:w-auto`}
                      >
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

                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center sm:justify-end">
                        <button
                          onClick={generateShareUrl}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-colors font-medium text-sm"
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

                  <div className="space-y-3 md:space-y-4">
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

                        <div className="surface-card p-4 md:p-5 text-sm text-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            Need unlimited checks and priority reliability?
                            <span className="font-semibold"> Upgrade when you are ready.</span>
                          </div>
                          <Link
                            href="/pricing"
                            className="inline-flex w-fit px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
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
                <div className="surface-card p-6 md:p-8 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">No copies found</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    We could not find matching tweets for this query right now.
                  </p>
                  <div className="text-left max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-800 mb-1">Try these next:</p>
                    <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
                      <li>Use broader wording instead of exact phrasing.</li>
                      <li>Try with the original tweet URL.</li>
                      <li>Retry after a few minutes for fresher indexing.</li>
                    </ul>
                  </div>
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
                      type="button"
                      onClick={() => handleSearch(broadenQueryText(query), { queryInputType: 'text' })}
                      className="inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                    >
                      Try broader wording
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetSearch();
                        setTimeout(() => focusSearchInput(), 0);
                      }}
                      className="inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                    >
                      Try with tweet URL
                    </button>
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
                <div className="surface-card p-6 md:p-8 text-center space-y-4">
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
                      className="inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-black transition-colors font-medium text-sm"
                    >
                      Retry Search
                    </button>
                    <a
                      href={`https://x.com/search?q=${encodeURIComponent(`"${query}"`)}&f=live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2 py-1 text-sm text-slate-700 hover:text-slate-900 underline underline-offset-2"
                    >
                      Search on X instead
                    </a>
                    <button
                      onClick={resetSearch}
                      className="inline-flex items-center px-2 py-1 text-sm text-slate-700 hover:text-slate-900 underline underline-offset-2"
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

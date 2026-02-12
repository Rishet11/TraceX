'use client';

import { useState, useMemo } from 'react';
import SearchInput from '@/components/SearchInput';
import ResultCard from '@/components/ResultCard'; // I'll use list directly or map here
import { calculateSimilarity } from '@/lib/similarity';
import { withQualityScores } from '@/lib/ranking';
import { encodeShareData } from '@/lib/urlEncoder';
import { Share2, ArrowDownUp, Filter } from 'lucide-react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle | loading | success | error
  const [searchMeta, setSearchMeta] = useState(null);
  const [lastSearchOptions, setLastSearchOptions] = useState({ queryInputType: 'text' });
  const [shareWarning, setShareWarning] = useState('');
  
  // Filter & Sort State
  const [similarityThreshold, setSimilarityThreshold] = useState(80);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'similarity', 'engagement'

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchText, ...normalizedOptions }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setSearchMeta(data.meta || null);
        throw new Error(data.error || 'Search failed');
      }

      // Calculate similarity for all results immediately
      const resultsWithScores = (data.results || []).map(tweet => {
        const engagement = (tweet.stats?.likes || 0) + (tweet.stats?.retweets || 0) + (tweet.stats?.replies || 0);
        const urlMatch = tweet.url?.match(/status\/(\d+)/);
        const parsedDate = Number.isFinite(Date.parse(tweet.date)) ? Date.parse(tweet.date) : null;
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
      console.error('Search error:', error);
      setResults([]);
      setSearchStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    let filtered = results.filter(r => r.similarityScore >= similarityThreshold);
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
    const medianEngagement = engagements.length === 0 ? 0 : (engagements.length % 2 === 0 ? (engagements[mid - 1] + engagements[mid]) / 2 : engagements[mid]);
    const viralThreshold = medianEngagement > 0 ? medianEngagement * 10 : Infinity;

    const scored = withQualityScores(filtered);

    const sorted = [...scored].sort((a, b) => {
      if (sortBy === 'similarity') {
        if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
        if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
        const aDate = a.parsedDate ?? -Infinity;
        const bDate = b.parsedDate ?? -Infinity;
        return bDate - aDate;
      }
      if (sortBy === 'engagement') {
        const diff = (b.engagement || 0) - (a.engagement || 0);
        if (diff !== 0) return diff;
        if ((b.qualityScore || 0) !== (a.qualityScore || 0)) return (b.qualityScore || 0) - (a.qualityScore || 0);
        return b.similarityScore - a.similarityScore;
      }
      if (sortBy === 'oldest') {
        const aDate = a.parsedDate ?? Infinity;
        const bDate = b.parsedDate ?? Infinity;
        if (aDate !== bDate) return aDate - bDate;
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      }
      // default date sort (newest first)
      const aDate = a.parsedDate ?? -Infinity;
      const bDate = b.parsedDate ?? -Infinity;
      if (bDate !== aDate) return bDate - aDate;
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });

    const oldestTweet = sorted.filter(r => r.parsedDate != null).reduce((prev, curr) => {
      if (!prev) return curr;
      return (curr.parsedDate ?? Infinity) < (prev.parsedDate ?? Infinity) ? curr : prev;
    }, null);

    return {
      sorted,
      medianEngagement,
      viralThreshold,
      oldestTweetId: oldestTweet?.tweetId || null,
    };
  }, [results, similarityThreshold, hideRetweets, sortBy]);

  const generateShareUrl = () => {
    const shareData = {
      q: query,
      r: processedData.sorted.map(r => ({
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
    const nitterAttempts = searchMeta?.sources?.nitter?.attempts || 0;
    const ddgAttempts = searchMeta?.sources?.duckduckgo?.attempts || 0;
    const bingAttempts = searchMeta?.sources?.bing?.attempts || 0;
    const jinaAttempts = searchMeta?.sources?.jina?.attempts || 0;
    if (!tried) return '';
    return `Tried ${tried} query variant${tried === 1 ? '' : 's'} across ${nitterAttempts} Nitter, ${ddgAttempts} DuckDuckGo, ${bingAttempts} Bing, and ${jinaAttempts} Jina attempt${jinaAttempts === 1 ? '' : 's'}.`;
  }, [searchMeta]);

  const sourceSummary = useMemo(() => {
    if (!searchMeta?.sources) return '';
    const available = [];
    const nitter = searchMeta.sources.nitter;
    const ddg = searchMeta.sources.duckduckgo;
    const bing = searchMeta.sources.bing;
    const jina = searchMeta.sources.jina;
    if (nitter?.attempts > nitter?.failures) available.push('Nitter');
    if (ddg?.attempts > ddg?.failures) available.push('DuckDuckGo');
    if (bing?.attempts > bing?.failures) available.push('Bing RSS');
    if (jina?.attempts > jina?.failures) available.push('Jina Mirror');
    if (available.length === 0) return '';
    return `Found using ${available.join(' + ')}`;
  }, [searchMeta]);

  const showDebugPanel = process.env.NODE_ENV !== 'production' && searchMeta;
  const isDegradedSources = searchStatus === 'error' && searchMeta?.reason === 'all_sources_failed';
  const totalMatches = results.length;
  const visibleMatches = processedData.sorted.length;
  const isShareSuccess = shareWarning.toLowerCase().includes('copied');

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
    <main className="min-h-screen bg-gray-50 flex flex-col py-8 px-4 md:px-0">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 tracking-wide">
            Search + Similarity + AI Verdict
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Tweet Copy Detector</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">Paste tweet text or a tweet URL to find likely copies, then filter by similarity and engagement.</p>
        </div>

        <SearchInput onSearch={handleSearch} isLoading={loading} />

        {searchStatus !== 'idle' && (
           <div className="space-y-6">
              {searchStatus === 'loading' && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <p className="text-gray-600 font-medium">Searching across sources and ranking matches...</p>
                </div>
              )}

              {searchStatus === 'success' && results.length > 0 && (
                <>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {visibleMatches} visible
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {totalMatches} total
                          </span>
                        </div>
                        {sourceSummary && (
                          <div className="text-xs text-gray-500">{sourceSummary}</div>
                        )}
                      </div>
                      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-3 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                          <Filter size={18} className="text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Similarity: {similarityThreshold}%+</span>
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
                        <div className={`text-xs rounded-lg px-3 py-2 border ${isShareSuccess ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
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
                          Sources:
                          {' '}
                          Nitter {searchMeta?.sources?.nitter?.attempts || 0}/{searchMeta?.sources?.nitter?.failures || 0} fail,
                          {' '}
                          DDG {searchMeta?.sources?.duckduckgo?.attempts || 0}/{searchMeta?.sources?.duckduckgo?.failures || 0} fail,
                          {' '}
                          Bing {searchMeta?.sources?.bing?.attempts || 0}/{searchMeta?.sources?.bing?.failures || 0} fail
                          ,
                          {' '}
                          Jina {searchMeta?.sources?.jina?.attempts || 0}/{searchMeta?.sources?.jina?.failures || 0} fail
                        </div>
                        <div>
                          Excluded: {searchMeta.excludedCount || 0}
                          {' · '}
                          Metrics Enriched: {searchMeta.metricsEnriched || 0}
                          {' · '}
                          Variants: {searchMeta?.variantsTried?.length || 0}
                        </div>
                      </div>
                    )}
                    {processedData.sorted.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        No results match your filters.
                      </div>
                    ) : (
                      processedData.sorted.map((tweet, i) => {
                        const badges = [];
                        if (tweet.similarityScore === 100) badges.push('💯 EXACT MATCH');
                        if (processedData.oldestTweetId && tweet.tweetId === processedData.oldestTweetId) badges.push('⭐ OLDEST');
                        if ((tweet.engagement || 0) >= processedData.viralThreshold) badges.push('🔥 VIRAL');

                        return (
                          <ResultCard 
                            key={i} 
                            tweet={tweet} 
                            originalText={query}
                            similarity={tweet.similarityScore}
                            badges={badges}
                          />
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {searchStatus === 'success' && results.length === 0 && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">No copies found</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        We could not find matching tweets for this query right now.
                    </p>
                    <div className="pt-2">
                      <a
                        href={`https://x.com/search?q=${encodeURIComponent('"' + query + '"')}&f=live`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                      >
                        Try on X
                      </a>
                    </div>
                    {diagnosticsText && (
                      <p className="text-xs text-gray-500 pt-1">{diagnosticsText}</p>
                    )}
                </div>
              )}

              {searchStatus === 'error' && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-4">
                    <div className="text-yellow-500 mx-auto w-12 h-12 flex items-center justify-center bg-yellow-50 rounded-full text-2xl">⚠️</div>
                    <h3 className="text-lg font-semibold text-gray-900">Automated Search Failed</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        {isDegradedSources
                          ? 'Search sources are temporarily degraded or rate-limited. Retry in a few seconds, or use manual X search.'
                          : 'Nitter instances are currently unavailable or blocking requests. Please try manually searching on X.'}
                    </p>
                    {isDegradedSources && (
                      <button
                        onClick={() => handleSearch(query, lastSearchOptions)}
                        className="inline-flex items-center px-5 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                      >
                        Retry Search
                      </button>
                    )}
                    <a 
                        href={`https://x.com/search?q=${encodeURIComponent('"' + query + '"')}&f=live`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                    >
                        Search on X for &quot;{query.slice(0, 20)}...&quot;
                    </a>
                </div>
              )}
           </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useState, useMemo } from 'react';
import SearchInput from '@/components/SearchInput';
import ResultCard from '@/components/ResultCard'; // I'll use list directly or map here
import { calculateSimilarity } from '@/lib/similarity';
import { encodeShareData } from '@/lib/urlEncoder';
import { Share2, ArrowDownUp, Filter } from 'lucide-react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle | loading | success | error
  
  // Filter & Sort State
  const [similarityThreshold, setSimilarityThreshold] = useState(80);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'similarity', 'engagement'

  const handleSearch = async (searchText) => {
    setLoading(true);
    setSearchStatus('loading');
    setQuery(searchText);
    setResults([]);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchText }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      // Calculate similarity for all results immediately
      const resultsWithScores = (data.results || []).map(tweet => ({
        ...tweet,
        similarityScore: calculateSimilarity(searchText, tweet.content)
      }));

      setResults(resultsWithScores);
      setSearchStatus('success');
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setSearchStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const processedResults = useMemo(() => {
    let filtered = results.filter(r => r.similarityScore >= similarityThreshold);
    
    if (hideRetweets) {
      // Simplistic check: if content starts with "RT @" or stats.retweets is undefined (unlikely)
      // Nitter usually handles RTs differently, but for now we rely on content or just ignore if implementation is tricky
      filtered = filtered.filter(r => !r.content.startsWith('RT @'));
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'similarity') return b.similarityScore - a.similarityScore;
      if (sortBy === 'engagement') return (b.stats.likes + b.stats.retweets) - (a.stats.likes + a.stats.retweets);
      // Date sort (default relative logic or parse date)
      // Simple string comparison for standard ISO-like dates work, but Nitter dates vary.
      // If native date object available, use it. For now assuming date string sort or stable.
      return 0; // Keep nitter order (usually chronological)
    });
  }, [results, similarityThreshold, hideRetweets, sortBy]);

  const generateShareUrl = () => {
    const shareData = {
      q: query,
      r: processedResults.map(r => ({
        ...r, // Optimization: pick only needed fields to save length
        score: r.similarityScore
      }))
    };
    const encoded = encodeShareData(shareData);
    const url = `${window.location.origin}/results?data=${encoded}`;
    navigator.clipboard.writeText(url);
    alert('Share link copied to clipboard!');
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col py-10 px-4 md:px-0">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Tweet Copy Detector</h1>
          <p className="text-slate-600">Find who stole your tweet in seconds. Free & Open Source.</p>
        </div>

        <SearchInput onSearch={handleSearch} isLoading={loading} />

        {searchStatus !== 'idle' && (
           <div className="space-y-6">
              {searchStatus === 'success' && results.length > 0 && (
                <>
                  <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
                     <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        <div className="flex items-center gap-2">
                          <Filter size={18} className="text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Similarity: {similarityThreshold}%+</span>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={similarityThreshold} 
                            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                            className="w-24 md:w-32 accent-blue-600"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
                           <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={hideRetweets} 
                                onChange={(e) => setHideRetweets(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              Hide Retweets
                           </label>
                        </div>

                        <div className="flex items-center gap-2">
                           <ArrowDownUp size={16} className="text-gray-500" />
                           <select 
                             value={sortBy} 
                             onChange={(e) => setSortBy(e.target.value)}
                             className="text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 bg-transparent py-1"
                           >
                             <option value="date">Newest First</option>
                             <option value="similarity">Highest Match</option>
                             <option value="engagement">Most Viral</option>
                           </select>
                        </div>
                     </div>

                     <div className="flex gap-2">
                        <button 
                          onClick={generateShareUrl}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                        >
                          <Share2 size={16} /> Share Results
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4">
                    {processedResults.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        No results match your filters.
                      </div>
                    ) : (
                      processedResults.map((tweet, i) => (
                        <ResultCard 
                          key={i} 
                          tweet={tweet} 
                          originalText={query}
                          similarity={tweet.similarityScore}
                          badges={tweet.similarityScore === 100 ? ['Exact Match'] : []}
                        />
                      ))
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
                </div>
              )}

              {searchStatus === 'error' && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-4">
                    <div className="text-yellow-500 mx-auto w-12 h-12 flex items-center justify-center bg-yellow-50 rounded-full text-2xl">⚠️</div>
                    <h3 className="text-lg font-semibold text-gray-900">Automated Search Failed</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Nitter instances are currently unavailable or blocking requests. 
                        Please try manually searching on X.
                    </p>
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

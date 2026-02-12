'use client';

import { useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ResultCard from '@/components/ResultCard';
import { decodeShareData } from '@/lib/urlEncoder';
import { ArrowLeft } from 'lucide-react';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { results, query } = useMemo(() => {
    const data = searchParams.get('data');
    if (!data) {
      return { results: [], query: '' };
    }
    const decoded = decodeShareData(data);
    if (decoded && Array.isArray(decoded.r)) {
      return { results: decoded.r, query: decoded.q || '' };
    }
    console.error('Invalid share data');
    return { results: [], query: '' };
  }, [searchParams]);

  const processedData = useMemo(() => {
    const normalized = results.map((tweet) => {
      const similarityScore = Number(tweet.score ?? tweet.similarityScore ?? 0);
      const parsedDate = Number.isFinite(Date.parse(tweet.date)) ? Date.parse(tweet.date) : null;
      const engagement =
        Number(tweet?.engagement) ||
        (Number(tweet?.stats?.likes) || 0) +
          (Number(tweet?.stats?.retweets) || 0) +
          (Number(tweet?.stats?.replies) || 0);
      const tweetIdMatch = String(tweet.url || '').match(/status\/(\d+)/);

      return {
        ...tweet,
        similarityScore,
        parsedDate,
        engagement,
        tweetId: tweet.tweetId || (tweetIdMatch ? tweetIdMatch[1] : null),
      };
    });

    const engagements = normalized.map((r) => r.engagement || 0).sort((a, b) => a - b);
    const mid = Math.floor(engagements.length / 2);
    const medianEngagement =
      engagements.length === 0
        ? 0
        : engagements.length % 2 === 0
          ? (engagements[mid - 1] + engagements[mid]) / 2
          : engagements[mid];
    const viralThreshold = medianEngagement > 0 ? medianEngagement * 10 : Infinity;

    const oldestTweet = normalized.filter((r) => r.parsedDate != null).reduce((prev, curr) => {
      if (!prev) return curr;
      return (curr.parsedDate ?? Infinity) < (prev.parsedDate ?? Infinity) ? curr : prev;
    }, null);

    return {
      normalized,
      oldestTweetId: oldestTweet?.tweetId || null,
      viralThreshold,
    };
  }, [results]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8">
       <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} /> Back to Search
          </button>
       </div>

       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Shared Search Results</h2>
          <p className="text-gray-600">Original Query: <span className="font-medium">&quot;{query}&quot;</span></p>
          <p className="text-sm text-gray-500 mt-1">Found {processedData.normalized.length} matches</p>
       </div>

       <div className="space-y-4">
          {processedData.normalized.map((tweet, i) => {
            const badges = [];
            if (tweet.similarityScore === 100) badges.push('💯 EXACT MATCH');
            if (processedData.oldestTweetId && tweet.tweetId === processedData.oldestTweetId) badges.push('⭐ OLDEST');
            if ((tweet.engagement || 0) >= processedData.viralThreshold) badges.push('🔥 VIRAL');

            return (
              <ResultCard
                key={tweet.tweetId || i}
                tweet={tweet}
                similarity={tweet.similarityScore}
                badges={badges}
              />
            );
          })}
       </div>
       
       {processedData.normalized.length === 0 && (
          <div className="text-center py-10 text-gray-500">
             No results found in this shared link.
          </div>
       )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col py-10 px-4 md:px-0">
       <Suspense fallback={<div>Loading...</div>}>
          <ResultsContent />
       </Suspense>
    </main>
  );
}

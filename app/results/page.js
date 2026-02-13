'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ResultCard from '@/components/ResultCard';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { decodeShareData } from '@/lib/urlEncoder';

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

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { results, query } = useMemo(() => {
    const data = searchParams.get('data');
    if (!data) return { results: [], query: '' };
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
      const parsedDateValue = Date.parse(tweet.date);
      const parsedDate = Number.isFinite(parsedDateValue) ? parsedDateValue : null;
      const engagement =
        Number(tweet?.engagement) ||
        parseMetricValue(tweet?.stats?.likes) +
          parseMetricValue(tweet?.stats?.retweets) +
          parseMetricValue(tweet?.stats?.replies);
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

    const oldestTweet = normalized
      .filter((r) => r.parsedDate != null)
      .reduce((prev, curr) => {
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
    <div className="container-main space-y-5">
      <button
        onClick={() => router.push('/')}
        className="btn btn-secondary px-3 py-2 text-sm"
      >
        <ArrowLeft size={18} /> Back to Search
      </button>

      <section className="surface p-6 md:p-7">
        <h1 className="heading-lg">Shared Search Results</h1>
        <p className="mt-2 text-ui">
          Original query:{' '}
          <span className="font-medium text-[var(--text-title)]">&quot;{query || 'N/A'}&quot;</span>
        </p>
        <p className="text-helper mt-1">Found {processedData.normalized.length} matches</p>
      </section>

      <section className="space-y-4">
        {processedData.normalized.map((tweet, i) => {
          const badges = [];
          if (tweet.similarityScore === 100) badges.push('💯 EXACT MATCH');
          if (processedData.oldestTweetId && tweet.tweetId === processedData.oldestTweetId) {
            badges.push('⭐ OLDEST');
          }
          if ((tweet.engagement || 0) >= processedData.viralThreshold) badges.push('🔥 VIRAL');

          return (
            <ResultCard
              key={tweet.tweetId || i}
              tweet={tweet}
              similarity={tweet.similarityScore}
              badges={badges}
              originalText={query}
            />
          );
        })}

        {processedData.normalized.length === 0 && (
          <div className="surface text-center py-10 text-[var(--text-muted)]">
            No results found in this shared link.
          </div>
        )}
      </section>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <Suspense fallback={<div className="container-main text-[var(--text-muted)]">Loading shared results...</div>}>
          <ResultsContent />
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Calendar,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

// DJB2 hash — fast string → number for cache keys.
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function isValidAnalysisPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Number.isFinite(Number(payload.score))) return false;
  if (typeof payload.verdict !== 'string' || !payload.verdict.trim()) return false;
  if (typeof payload.explanation !== 'string' || !payload.explanation.trim()) return false;
  return true;
}

function sourceLabel(source) {
  const key = String(source || '').toLowerCase();
  if (key === 'nitter') return 'Search mirror';
  if (key === 'duckduckgo') return 'Web discovery';
  if (key === 'bing') return 'News index';
  if (key === 'jina' || key === 'jina_status') return 'Archive mirror';
  if (key === 'syndication') return 'Syndication';
  return '';
}

export default function ResultCard({ tweet, similarity, badges, originalText }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState(tweet?.author?.avatar || DEFAULT_AVATAR);

  useEffect(() => {
    setAvatarSrc(tweet?.author?.avatar || DEFAULT_AVATAR);
  }, [tweet?.author?.avatar]);

  const stats = tweet?.stats || {};
  const similarityColor =
    similarity >= 90
      ? 'text-green-700 bg-green-50 border-green-200'
      : similarity >= 70
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-slate-700 bg-slate-50 border-slate-200';

  const formatMetric = (value) => {
    if (Number.isFinite(value)) return compactNumber.format(value);
    const raw = String(value ?? '').trim();
    if (!raw) return '0';
    if (/^\d+(\.\d+)?\s*[KMB]$/i.test(raw)) {
      return raw.replace(/\s+/g, '').toUpperCase();
    }
    const numeric = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(numeric)) return compactNumber.format(numeric);
    return '0';
  };

  const source = sourceLabel(tweet?.source);

  const handleAnalyze = async () => {
    if (!originalText?.trim()) {
      setError('Original tweet text is missing. Run a search again.');
      return;
    }

    // ── Cache key: simple hash of the two texts ─────────────────────
    const cacheKey = `tracex_ai_${simpleHash(originalText + '||' + tweet.content)}`;

    // Check sessionStorage for a cached result first.
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (isValidAnalysisPayload(parsed)) {
          setAnalysis(parsed);
          trackEvent('ai_analysis_cached', { similarity });
          return;
        }
      }
    } catch { /* ignore corrupt cache */ }

    setIsAnalyzing(true);
    setAnalysis(null);
    setError(null);
    trackEvent('ai_analysis_requested', { similarity });

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: originalText,
          candidate: tweet.content,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Analysis failed');
      if (!isValidAnalysisPayload(data)) {
        throw new Error('AI returned an invalid analysis format. Please retry.');
      }
      setAnalysis(data);
      trackEvent('ai_analysis_completed', {
        verdict: data.verdict,
        score: data.score,
      });

      // Persist to sessionStorage (fire-and-forget).
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* quota exceeded */ }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <article className="surface surface-hover p-4 md:p-5">
      <header className="flex items-start justify-between gap-3 md:gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <Image
              src={avatarSrc}
              alt={tweet?.author?.username || 'avatar'}
              width={52}
              height={52}
              className="w-12 h-12 md:w-13 md:h-13 rounded-full bg-slate-50 object-cover border border-slate-200"
              unoptimized
              loader={({ src }) => src}
              onError={() => setAvatarSrc(DEFAULT_AVATAR)}
            />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-[var(--text-title)] leading-tight text-lg truncate">
              {tweet?.author?.fullname || 'Unknown'}
            </p>
            <p className="text-[var(--text-muted)] text-sm truncate">
              @{String(tweet?.author?.username || 'unknown').replace(/^@+/, '')}
            </p>
            {source && <span className="chip mt-1">{source}</span>}
          </div>
        </div>

        <div className="shrink-0 text-right space-y-1">
          <div className={cn('px-3 py-1.5 rounded-full text-sm font-bold border', similarityColor)}>
            {similarity}% Match
          </div>
          <p
            className="text-[11px] text-[var(--text-muted)]"
            title="Based on textual similarity, structure overlap, and ranking quality signals."
          >
            Similarity + quality
          </p>
        </div>
      </header>

      <p className="text-[var(--text-body)] text-[15px] md:text-base mb-4 whitespace-pre-wrap break-words leading-[1.58]">
        {tweet?.content || ''}
      </p>

      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {badges.map((badge, index) => (
            <span
              key={index}
              className="px-2.5 py-1 bg-[var(--brand-50)] text-[var(--brand-700)] text-xs rounded-lg font-semibold border border-[var(--brand-100)]"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[var(--text-muted)] text-sm">
          <span className="flex items-center gap-1.5" title="Replies">
            <MessageCircle size={17} />
            <span className="font-medium">{formatMetric(stats.replies)}</span>
          </span>
          <span className="flex items-center gap-1.5" title="Retweets">
            <Repeat size={17} />
            <span className="font-medium">{formatMetric(stats.retweets)}</span>
          </span>
          <span className="flex items-center gap-1.5" title="Likes">
            <Heart size={17} />
            <span className="font-medium">{formatMetric(stats.likes)}</span>
          </span>
          <span className="flex items-center gap-1.5" title="Views">
            <Eye size={17} />
            <span className="font-medium">{formatMetric(stats.views)}</span>
          </span>
          <span className="flex items-center gap-1.5" title="Bookmarks">
            <Bookmark size={17} />
            <span className="font-medium">{formatMetric(stats.bookmarks)}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!analysis && !isAnalyzing && (
            <div className="flex flex-col gap-1">
              <button
                onClick={handleAnalyze}
                className="btn btn-ghost px-3 py-1.5 text-xs border border-transparent hover:border-violet-100 hover:bg-violet-50 hover:text-violet-800 w-fit"
                disabled={isAnalyzing}
              >
                <Sparkles size={14} /> Analyze with AI
              </button>
              <p className="text-[11px] text-[var(--text-muted)]">See if this looks like likely idea theft.</p>
            </div>
          )}

          <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
            <Calendar size={15} /> {tweet?.relativeDate || 'Recently found'}
          </span>
          <a
            href={tweet?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary px-3 py-1.5 text-xs"
          >
            View Tweet <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mt-5 p-3 bg-violet-50 rounded-[var(--radius-sm)] border border-violet-100 animate-pulse flex items-center gap-3">
          <Sparkles className="text-violet-500" size={18} />
          <span className="text-violet-700 font-medium text-sm">Analyzing similarity with AI...</span>
        </div>
      )}

      {error && (
        <div className="mt-5 p-3 bg-[var(--danger-50)] text-[var(--danger-600)] rounded-[var(--radius-sm)] text-sm border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {analysis && (
        <div className="mt-5 bg-violet-50/80 rounded-[var(--radius-md)] border border-violet-100 p-4">
          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
            <h4 className="font-bold text-violet-900 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              AI Verdict: {analysis.verdict}
            </h4>
            <span className="bg-white text-violet-700 px-2 py-1 rounded-md text-xs font-bold border border-violet-100">
              {analysis.score}/100 Confidence
            </span>
          </div>
          <p className="text-violet-900/85 text-sm leading-relaxed">{analysis.explanation}</p>
        </div>
      )}
    </article>
  );
}

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

const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

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

    setIsAnalyzing(true);
    setAnalysis(null);
    setError(null);

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
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <article className="surface-card surface-interactive p-5 md:p-6">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
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
            <div className="font-bold text-slate-900 leading-tight text-lg truncate">
              {tweet?.author?.fullname || 'Unknown'}
            </div>
            <div className="text-slate-500 text-sm truncate">
              @{String(tweet?.author?.username || 'unknown').replace(/^@+/, '')}
            </div>
            {source && (
              <div className="mt-1 text-[11px] inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {source}
              </div>
            )}
          </div>
        </div>

        <div className={cn('px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm shrink-0', similarityColor)}>
          {similarity}% Match
        </div>
      </header>

      <p className="text-slate-800 text-base md:text-lg mb-5 whitespace-pre-wrap break-words leading-[1.6]">
        {tweet?.content || ''}
      </p>

      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {badges.map((badge, index) => (
            <span
              key={index}
              className="px-2.5 py-1 bg-[var(--brand-50)] text-[var(--brand-600)] text-xs rounded-lg font-semibold border border-[var(--brand-100)] tracking-wide uppercase"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-slate-100 space-y-3.5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-slate-500 text-sm">
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
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 text-violet-700 hover:text-violet-900 hover:bg-violet-50 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border border-transparent hover:border-violet-100"
              disabled={isAnalyzing}
            >
              <Sparkles size={14} /> Analyze with AI
            </button>
          )}

          <span className="flex items-center gap-1.5 text-slate-600 text-xs">
            <Calendar size={15} /> {tweet?.relativeDate || 'Recently found'}
          </span>
          <a
            href={tweet?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition-all text-xs"
          >
            View Tweet <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mt-5 p-3 bg-violet-50 rounded-xl border border-violet-100 animate-pulse flex items-center gap-3">
          <Sparkles className="text-violet-500" size={18} />
          <span className="text-violet-700 font-medium text-sm">Analyzing similarity with AI...</span>
        </div>
      )}

      {error && (
        <div className="mt-5 p-3 bg-[var(--danger-50)] text-[var(--danger-600)] rounded-lg text-sm border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {analysis && (
        <div className="mt-5 bg-violet-50 rounded-xl border border-violet-100 p-4">
          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
            <h4 className="font-bold text-violet-900 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              AI Verdict: {analysis.verdict}
            </h4>
            <span className="bg-white text-violet-700 px-2 py-1 rounded-md text-xs font-bold border border-violet-100 shadow-sm">
              {analysis.score}/100 Confidence
            </span>
          </div>
          <p className="text-violet-900/90 text-sm leading-relaxed">{analysis.explanation}</p>
        </div>
      )}
    </article>
  );
}

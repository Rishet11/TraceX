import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ExternalLink, Heart, MessageCircle, Repeat, Calendar, Sparkles, AlertCircle, Eye, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn is available

const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function isValidAnalysisPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Number.isFinite(Number(payload.score))) return false;
  if (typeof payload.verdict !== 'string' || !payload.verdict.trim()) return false;
  if (typeof payload.explanation !== 'string' || !payload.explanation.trim()) return false;
  return true;
}

export default function ResultCard({ tweet, similarity, badges, originalText }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState(tweet.author.avatar || DEFAULT_AVATAR);

  useEffect(() => {
    setAvatarSrc(tweet.author.avatar || DEFAULT_AVATAR);
  }, [tweet.author.avatar]);

  const similarityColor = similarity >= 90 ? 'text-green-600 bg-green-50 border-green-200' :
    similarity >= 70 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-gray-600 bg-gray-50 border-gray-200';
  const formatMetric = (value) => compactNumber.format(Number(value) || 0);

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
          candidate: tweet.content
        })
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
    <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl hover:border-gray-200 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        {/* Author Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Image
                src={avatarSrc}
                alt={tweet.author.username || 'avatar'}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full bg-gray-50 object-cover border-2 border-white shadow-sm"
                unoptimized
                loader={({ src }) => src}
                onError={() => setAvatarSrc(DEFAULT_AVATAR)}
            />
            {tweet.source === 'duckduckgo' && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm" title="Found via DuckDuckGo">
                    <div className="w-4 h-4 rounded-full bg-orange-400" /> 
                </div>
            )}
          </div>
          <div>
            <div className="font-bold text-gray-900 leading-tight text-lg">{tweet.author.fullname}</div>
            <div className="text-gray-500 text-sm">@{tweet.author.username}</div>
          </div>
        </div>
        
        {/* Similarity Badge */}
        <div className={cn("px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm", similarityColor)}>
          {similarity}% Match
        </div>
      </div>

      <p className="text-gray-800 text-lg mb-5 whitespace-pre-wrap leading-relaxed font-normal">
        {tweet.content}
      </p>

      {/* Badges */}
      {badges && badges.length > 0 && (
         <div className="flex flex-wrap gap-2 mb-5">
            {badges.map((badge, index) => (
            <span key={index} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg font-semibold border border-blue-100 tracking-wide uppercase">
                {badge}
            </span>
            ))}
         </div>
      )}

      {/* Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-5 border-t border-gray-100 text-gray-500 text-sm">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5 hover:text-blue-500 transition-colors" title="Replies">
            <MessageCircle size={18} /> <span className="font-medium">{formatMetric(tweet.stats.replies)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-green-500 transition-colors" title="Retweets">
            <Repeat size={18} /> <span className="font-medium">{formatMetric(tweet.stats.retweets)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-pink-500 transition-colors" title="Likes">
            <Heart size={18} /> <span className="font-medium">{formatMetric(tweet.stats.likes)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-slate-600 transition-colors" title="Views">
            <Eye size={18} /> <span className="font-medium">{formatMetric(tweet.stats?.views)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-amber-600 transition-colors" title="Bookmarks">
            <Bookmark size={18} /> <span className="font-medium">{formatMetric(tweet.stats?.bookmarks)}</span>
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
           {/* AI Analysis Button */}
           {!analysis && !isAnalyzing && (
             <button
               onClick={handleAnalyze}
               className="flex items-center gap-1.5 text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-3 py-1.5 rounded-lg font-medium transition-all text-xs border border-transparent hover:border-violet-100"
               disabled={isAnalyzing}
             >
                <Sparkles size={14} /> Analyze with AI
             </button>
           )}
           
           <span className="flex items-center gap-1.5 text-gray-400">
             <Calendar size={16} /> {tweet.relativeDate}
           </span>
           <a 
             href={tweet.url} 
             target="_blank" 
             rel="noopener noreferrer"
             className="flex items-center gap-1.5 text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-all text-xs"
           >
             View Tweet <ExternalLink size={14} />
           </a>
        </div>
      </div>
      
      {/* Analysis Result */}
      {isAnalyzing && (
        <div className="mt-4 p-4 bg-violet-50 rounded-xl border border-violet-100 animate-pulse flex items-center gap-3">
            <Sparkles className="text-violet-500 animate-spin-slow" size={20} />
            <span className="text-violet-700 font-medium">Gemini AI is analyzing similarity...</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
           <AlertCircle size={16} /> {error}
        </div>
      )}

      {analysis && (
        <div className="mt-4 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-violet-900 flex items-center gap-2">
                    <Sparkles size={18} className="text-violet-600" />
                    AI Verdict: {analysis.verdict}
                </h4>
                <span className="bg-white text-violet-700 px-2 py-1 rounded-md text-xs font-bold border border-violet-100 shadow-sm">
                    {analysis.score}/100 Confidence
                </span>
            </div>
            <p className="text-violet-800 text-sm leading-relaxed">
                {analysis.explanation}
            </p>
        </div>
      )}
    </div>
  );
}

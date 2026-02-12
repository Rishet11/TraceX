'use client';

import { useState } from 'react';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchInput({ onSearch, isLoading }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!input.trim()) {
      setError('Please enter text or a tweet URL');
      return;
    }

    // Check if input is a URL
    const urlPattern = /(https?:\/\/(www\.)?(twitter\.com|x\.com|nitter\.[a-z]+)\/[a-zA-Z0-9_]+\/status\/\d+)/;
    const match = input.match(urlPattern);

    if (match) {
      // It's a URL, fetch content first
      setIsFetchingUrl(true);
      try {
        const response = await fetch('/api/tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: match[0] }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch tweet');
        }
        if (data?.unavailable || !data?.tweet?.content) {
          setError(data?.message || 'Could not fetch tweet automatically. Please paste the tweet text directly.');
          return;
        }

        // Call search with fetched content
        // We might want to pass the original URL too for "Copy Detected" context
        onSearch(data.tweet.content, {
          queryInputType: 'url_text_extracted',
          excludeTweetId: data.tweetId || null,
          excludeUsername: data.tweet?.username || null,
          excludeContent: data.tweet?.content || null,
        });
      } catch (err) {
        console.error(err);
        setError('Could not fetch tweet automatically. Please paste the text directly.');
        // Optional: clear the input or select it so they can paste over
      } finally {
        setIsFetchingUrl(false);
      }
    } else {
      // It's plain text
      if (input.length < 10) {
        setError('Please enter at least 10 characters for a meaningful search');
        return;
      }
      onSearch(input, { queryInputType: 'text' });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-2">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl opacity-20 group-hover:opacity-35 transition duration-500 blur-lg"></div>
        <div className="relative bg-white rounded-2xl shadow-lg flex flex-col p-3 border border-gray-100 transition-all duration-300">
          <textarea
            className="w-full p-4 bg-transparent outline-none text-gray-800 placeholder-gray-400 font-medium text-lg resize-none min-h-[130px]"
            placeholder="Paste tweet text or URL here to find copies..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isFetchingUrl}
            aria-label="Tweet text or URL input"
          />
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 px-3 pb-1">
             <div className="text-xs text-gray-400 font-medium flex items-center gap-2">
                {input.length > 0 && `${input.length} characters`}
                <span className="text-gray-300">•</span>
                <span>Supports X/Twitter URLs</span>
             </div>
             <button
                type="submit"
                disabled={isLoading || isFetchingUrl || !input.trim()}
                className={cn(
                    "px-5 py-2.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95",
                    isLoading || isFetchingUrl 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : "bg-gray-900 hover:bg-black"
                )}
              >
                {isLoading || isFetchingUrl ? (
                <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    <span>{isFetchingUrl ? 'Fetching...' : 'Searching...'}</span>
                </>
                ) : (
                    <>
                        <span>Check for Copies</span>
                        <Search size={18} />
                    </>
                )}
             </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

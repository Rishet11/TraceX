'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchInput({ onSearch, isLoading }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!input.trim()) {
      setError('Please enter tweet text or a tweet URL.');
      return;
    }

    const urlPattern =
      /(https?:\/\/(www\.)?(twitter\.com|x\.com|nitter\.[a-z]+)\/[a-zA-Z0-9_]+\/status\/\d+)/;
    const match = input.match(urlPattern);

    if (match) {
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
          setError(
            data?.message || 'Could not fetch this tweet automatically. Paste the tweet text instead.'
          );
          return;
        }

        onSearch(data.tweet.content, {
          queryInputType: 'url_text_extracted',
          excludeTweetId: data.tweetId || null,
          excludeUsername: data.tweet?.username || null,
          excludeContent: data.tweet?.content || null,
        });
      } catch (err) {
        console.error(err);
        setError('Could not fetch this tweet automatically. Paste the tweet text instead.');
      } finally {
        setIsFetchingUrl(false);
      }
      return;
    }

    if (input.trim().length < 10) {
      setError('Please enter at least 10 characters for a meaningful search.');
      return;
    }

    onSearch(input, { queryInputType: 'text' });
  };

  return (
    <section className="surface-elevated p-4 md:p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tweet-query" className="block text-sm font-semibold text-slate-800 mb-1">
            Tweet text or URL
          </label>
          <p className="text-xs text-slate-600">
            Paste a tweet URL or plain text to check for likely copies.
          </p>
        </div>
        <textarea
          id="tweet-query"
          className="w-full p-4 bg-white outline-none text-slate-800 placeholder-slate-400 font-medium text-lg resize-none min-h-[140px] rounded-xl border border-[var(--border)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-100)]"
          placeholder="Paste tweet text or URL here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || isFetchingUrl}
          aria-label="Tweet text or URL input"
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            {input.length > 0 ? `${input.length} characters` : 'Supports X/Twitter URLs and plain text'}
          </div>
          <button
            type="submit"
            disabled={isLoading || isFetchingUrl || !input.trim()}
            className={cn(
              'px-5 py-2.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-sm',
              isLoading || isFetchingUrl
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-black'
            )}
          >
            {isLoading || isFetchingUrl ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                <span>{isFetchingUrl ? 'Fetching tweet...' : 'Searching...'}</span>
              </>
            ) : (
              <>
                <span>Paste and Search</span>
                <Search size={18} />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-[var(--danger-50)] text-[var(--danger-600)] rounded-xl border border-red-100 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </section>
  );
}

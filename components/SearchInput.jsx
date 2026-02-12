'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchInput({ onSearch, isLoading, prefillText = '' }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [flashInput, setFlashInput] = useState(false);

  useEffect(() => {
    if (!prefillText) return;
    setInput(prefillText);
    setFlashInput(true);
    const timer = setTimeout(() => setFlashInput(false), 550);
    return () => clearTimeout(timer);
  }, [prefillText]);

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
    <section className="surface-elevated p-4 md:p-6 border border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tweet-query" className="block text-lg font-semibold text-[#111827] mb-2">
            Tweet text or URL
          </label>
          <p className="text-sm text-[#6B7280]">
            Paste a tweet URL or plain text to check for likely copies.
          </p>
        </div>
        <textarea
          id="tweet-query"
          className={cn(
            'w-full p-4 bg-white outline-none text-[#374151] placeholder:text-[#9CA3AF] font-medium text-base resize-none min-h-[170px] rounded-lg border-2 border-[#3B82F6] transition-all duration-150 ease-in',
            'focus:border-[#2563EB] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]',
            flashInput && 'shadow-[0_0_0_3px_rgba(37,99,235,0.18)]'
          )}
          placeholder="Paste tweet text or URL here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || isFetchingUrl}
          aria-label="Tweet text or URL input"
          autoFocus
        />
        <div className="flex flex-col gap-3 pt-1">
          <div className="text-sm text-[#6B7280]">
            {input.length > 0 ? `${input.length} characters` : 'Supports X/Twitter URLs and plain text'}
          </div>
          <button
            type="submit"
            disabled={isLoading || isFetchingUrl || !input.trim()}
            className={cn(
              'w-full md:w-auto md:min-w-[260px] md:self-center px-8 py-3 rounded-lg font-semibold text-base text-white transition-all duration-200 ease-in-out flex items-center justify-center gap-2',
              isLoading || isFetchingUrl
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8] hover:shadow-[0_4px_6px_rgba(37,99,235,0.25),0_2px_4px_rgba(37,99,235,0.15)] hover:-translate-y-px active:bg-[#1E40AF] active:translate-y-0 active:shadow-[0_2px_4px_rgba(37,99,235,0.2)]'
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

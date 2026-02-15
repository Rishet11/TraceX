'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const SAMPLE_INPUTS = [
  'Just finished shipping v2 after 3 failed launches. Keep building.',
  'What is one thing AI can never replace?',
  'Build in public and show your work daily.',
];

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
          sourceUrl: match[0],
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

  const applySample = (sample) => {
    setInput(sample);
    setError('');
    setFlashInput(true);
    setTimeout(() => setFlashInput(false), 350);
  };

  return (
    <section className="surface p-4 md:p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tweet-query" className="block text-sm font-semibold text-[var(--text-title)] mb-2">
            Tweet text or URL
          </label>
          <div className="mt-3">
            <p className="text-[11px] text-[var(--text-muted)] mb-1.5">Try a sample:</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_INPUTS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => applySample(sample)}
                  className="px-2.5 py-1.5 text-[11px] rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text-body)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] transition-colors"
                >
                  {sample.length > 36 ? `${sample.slice(0, 36)}...` : sample}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={cn('input-shell', flashInput && 'border-[var(--brand-500)] shadow-[0_0_0_3px_rgba(37,99,235,0.18)]')}>
          <textarea
            id="tweet-query"
            className="w-full p-4 bg-transparent outline-none text-[var(--text-body)] placeholder:text-[var(--text-faint)] font-medium text-base resize-none min-h-[144px] rounded-[inherit]"
            placeholder="Paste tweet text or URL here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isFetchingUrl}
            aria-label="Tweet text or URL input"
            autoFocus
          />
        </div>
        <div className="flex flex-col items-center gap-2.5 pt-2">
          <div className="text-helper">
            {input.length > 0 ? `${input.length} characters` : 'Supports X/Twitter URLs and plain text'}
          </div>
          <button
            type="submit"
            disabled={isLoading || isFetchingUrl || !input.trim()}
            className={cn(
              'btn btn-primary w-full sm:w-[240px] h-12 px-6 text-[15px]',
              isLoading || isFetchingUrl
                ? 'bg-[var(--brand-300)] border-[var(--brand-300)] shadow-none'
                : ''
            )}
          >
            {isLoading || isFetchingUrl ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                <span>{isFetchingUrl ? 'Fetching tweet...' : 'Searching...'}</span>
              </>
            ) : (
              <>
                <span>Search for copies</span>
                <Search size={18} />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 p-3 status-danger rounded-[var(--radius-sm)] flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </section>
  );
}

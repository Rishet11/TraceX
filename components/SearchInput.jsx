'use client';

import { useState } from 'react';
import { Search, Link as LinkIcon, AlertCircle, Loader2 } from 'lucide-react';
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

        // Call search with fetched content
        // We might want to pass the original URL too for "Copy Detected" context
        onSearch(data.tweet.content);
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
      onSearch(input);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            className={cn(
              "w-full p-4 pr-12 text-lg border-2 rounded-xl outline-none transition-all resize-none min-h-[120px]",
              error ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-blue-500 shadow-sm focus:shadow-md"
            )}
            placeholder="Paste tweet text or URL here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isFetchingUrl}
          />
          <div className="absolute bottom-4 right-4 text-gray-400">
             {/* Character count or icon can go here */}
          </div>
        </div>

        {error && (
          <div className="mt-2 flex items-center text-red-500 text-sm animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={16} className="mr-1" />
            {error}
          </div>
        )}

        <button
          type="submit"
          className={cn(
            "mt-4 w-full py-3 px-6 rounded-lg text-white font-semibold text-lg flex items-center justify-center transition-all",
            isLoading || isFetchingUrl
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 active:scale-[0.98] shadow-md hover:shadow-lg"
          )}
          disabled={isLoading || isFetchingUrl}
        >
          {isLoading || isFetchingUrl ? (
            <>
              <Loader2 className="animate-spin mr-2" />
              {isFetchingUrl ? 'Fetching Tweet...' : 'Searching Copies...'}
            </>
          ) : (
            <>
              <Search className="mr-2" size={20} />
              Check for Copies
            </>
          )}
        </button>
      </form>
    </div>
  );
}

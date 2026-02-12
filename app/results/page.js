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
          <p className="text-sm text-gray-500 mt-1">Found {results.length} matches</p>
       </div>

       <div className="space-y-4">
          {results.map((tweet, i) => (
             <ResultCard 
               key={i} 
               tweet={tweet} 
               similarity={tweet.score || tweet.similarityScore || 0} // robustness
               badges={tweet.score === 100 ? ['Exact Match'] : []}
             />
          ))}
       </div>
       
       {results.length === 0 && (
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

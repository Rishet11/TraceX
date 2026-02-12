import ResultCard from './ResultCard';

export default function ResultsList({ results, similarityCheck }) {
  return (
    <div className="space-y-4">
      {results.map((tweet, index) => {
         const similarity = similarityCheck(tweet.content);
         // Todo: calculate badges logic here or pass from parent
         const badges = [];
         if (similarity === 100) badges.push('Exact Match');
         // if (index === results.length - 1) badges.push('Oldest'); // Logic depends on sort order

         return (
            <ResultCard key={index} tweet={tweet} similarity={similarity} badges={badges} />
         );
      })}
    </div>
  );
}

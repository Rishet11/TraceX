import { ExternalLink, Heart, MessageCircle, Repeat, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResultCard({ tweet, similarity, badges }) {
  const similarityColor = similarity >= 90 ? 'text-green-600 bg-green-50 border-green-200' :
    similarity >= 70 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-gray-600 bg-gray-50 border-gray-200';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <img 
            src={tweet.author.avatar || '/placeholder-avatar.png'} 
            alt={tweet.author.username}
            className="w-10 h-10 rounded-full bg-gray-200 object-cover"
            onError={(e) => { e.target.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }} 
          />
          <div>
            <div className="font-bold text-gray-900">{tweet.author.fullname}</div>
            <div className="text-gray-500 text-sm">@{tweet.author.username}</div>
          </div>
        </div>
        <div className={cn("px-2 py-1 rounded-full text-xs font-bold border", similarityColor)}>
          {similarity}% Match
        </div>
      </div>

      <p className="text-gray-800 text-lg mb-4 whitespace-pre-wrap leading-relaxed">
        {tweet.content}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {badges && badges.map((badge, index) => (
          <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium border border-blue-100">
            {badge}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-gray-500 text-sm">
        <div className="flex gap-4">
          <span className="flex items-center gap-1" title="Replies">
            <MessageCircle size={16} /> {tweet.stats.replies}
          </span>
          <span className="flex items-center gap-1" title="Retweets">
            <Repeat size={16} /> {tweet.stats.retweets}
          </span>
          <span className="flex items-center gap-1" title="Likes">
            <Heart size={16} /> {tweet.stats.likes}
          </span>
        </div>
        <div className="flex items-center gap-3">
           <span className="flex items-center gap-1">
             <Calendar size={14} /> {tweet.relativeDate}
           </span>
           <a 
             href={tweet.url} 
             target="_blank" 
             rel="noopener noreferrer"
             className="flex items-center gap-1 text-blue-500 hover:text-blue-700 font-medium transition-colors"
           >
             View <ExternalLink size={14} />
           </a>
        </div>
      </div>
    </div>
  );
}

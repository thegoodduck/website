import type { Match } from '@/lib/scraper/types';
import { MatchCard } from './MatchCard';

export function MatchGrid({ matches, title }: { matches: Match[]; title?: string }) {
  if (matches.length === 0) return null;

  return (
    <section>
      {title && (
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {matches.map(m => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}

'use client';

import { useMatches } from '@/hooks/useMatches';
import { MatchGrid } from '@/components/match/MatchGrid';
import { HeroLink } from '@/components/layout/HeroLink';
import { MatchCardSkeleton } from '@/components/common/Skeleton';

export default function Home() {
  const { matches, isLoading } = useMatches();

  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches.filter(m => m.status === 'upcoming');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <HeroLink />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <MatchCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="space-y-10">
          {live.length > 0 && <MatchGrid matches={live} title="Live Now" />}
          {upcoming.length > 0 && <MatchGrid matches={upcoming} title="Upcoming" />}
          {matches.length === 0 && (
            <div className="text-center py-20">
                            <p className="text-text-muted text-lg">No matches found right now</p>
              <p className="text-text-muted text-sm mt-2">Check back soon — matches are refreshed every 2 minutes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

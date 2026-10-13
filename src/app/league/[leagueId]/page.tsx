'use client';

import { use } from 'react';
import { useMatches } from '@/hooks/useMatches';
import { MatchGrid } from '@/components/match/MatchGrid';
import { MatchCardSkeleton } from '@/components/common/Skeleton';
import Link from 'next/link';

export default function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = use(params);
  const { matches, isLoading } = useMatches({ league: leagueId });

  const leagueName = matches[0]?.league || 'League';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/" className="text-text-muted hover:text-accent text-sm mb-4 inline-block">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mb-6">{leagueName}</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <MatchCardSkeleton key={i} />)}
        </div>
      ) : (
        <MatchGrid matches={matches} />
      )}

      {!isLoading && matches.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted">No matches in this league right now</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useMatches } from '@/hooks/useMatches';
import { MatchGrid } from '@/components/match/MatchGrid';
import { MatchFilters } from '@/components/match/MatchFilters';
import { MatchCardSkeleton } from '@/components/common/Skeleton';

export default function CatalogPage() {
  const { matches, isLoading } = useMatches();
  const [selectedLeague, setSelectedLeague] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const leagues = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of matches) {
      if (!seen.has(m.leagueId)) seen.set(m.leagueId, m.league);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [matches]);

  const filtered = useMemo(() => {
    let result = matches;
    if (selectedLeague) result = result.filter(m => m.leagueId === selectedLeague);
    if (selectedStatus) result = result.filter(m => m.status === selectedStatus);
    return result;
  }, [matches, selectedLeague, selectedStatus]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Match Catalog</h1>

      <MatchFilters
        leagues={leagues}
        selectedLeague={selectedLeague}
        selectedStatus={selectedStatus}
        onLeagueChange={setSelectedLeague}
        onStatusChange={setSelectedStatus}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <MatchCardSkeleton key={i} />)}
        </div>
      ) : (
        <MatchGrid matches={filtered} />
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted">No matches found with current filters</p>
        </div>
      )}
    </div>
  );
}

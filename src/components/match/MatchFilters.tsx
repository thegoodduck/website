'use client';

interface Props {
  leagues: { id: string; name: string }[];
  selectedLeague: string;
  selectedStatus: string;
  onLeagueChange: (id: string) => void;
  onStatusChange: (status: string) => void;
}

export function MatchFilters({ leagues, selectedLeague, selectedStatus, onLeagueChange, onStatusChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={selectedStatus}
        onChange={e => onStatusChange(e.target.value)}
        className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">All Status</option>
        <option value="live">Live</option>
        <option value="upcoming">Upcoming</option>
        <option value="finished">Finished</option>
      </select>

      <select
        value={selectedLeague}
        onChange={e => onLeagueChange(e.target.value)}
        className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">All Leagues</option>
        {leagues.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}

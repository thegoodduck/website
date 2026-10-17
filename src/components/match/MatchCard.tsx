import Link from 'next/link';
import type { Match } from '@/lib/scraper/types';
import { LiveBadge } from './LiveBadge';

export function MatchCard({ match }: { match: Match }) {
  return (
    <Link
      href={`/watch/${match.id}`}
      className="block bg-card hover:bg-card-hover border border-white/5 rounded-xl p-4 transition group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted truncate">{match.league}</span>
        {match.status === 'live' && <LiveBadge />}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p className="font-semibold text-sm truncate">{match.homeTeam}</p>
        </div>

        <div className="flex-shrink-0 text-center min-w-[60px]">
          {match.status === 'live' && match.score ? (
            <span className="text-lg font-bold text-accent">{match.score}</span>
          ) : (
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted/60">
                {new Date(match.kickoff).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-text-muted">
                {new Date(match.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 text-left">
          <p className="font-semibold text-sm truncate">{match.awayTeam}</p>
        </div>
      </div>

      <div className="mt-3 text-center">
        <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition">
          Watch Stream →
        </span>
      </div>
    </Link>
  );
}

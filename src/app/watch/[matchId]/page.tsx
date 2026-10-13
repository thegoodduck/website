'use client';

import { use } from 'react';
import { useStream } from '@/hooks/useStream';
import { useMatches } from '@/hooks/useMatches';
import { usePeerStats } from '@/hooks/usePeerStats';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { MatchGrid } from '@/components/match/MatchGrid';
import { LiveBadge } from '@/components/match/LiveBadge';
import Link from 'next/link';

export default function WatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const { streamUrl, isLoading: streamLoading } = useStream(matchId);
  const { matches } = useMatches();
  const { stats, update } = usePeerStats();

  const match = matches.find(m => m.id === matchId);
  const related = matches.filter(m => m.id !== matchId).slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link href="/" className="text-text-muted hover:text-accent text-sm mb-4 inline-block">
        ← Back to matches
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VideoPlayer
            streamUrl={streamUrl}
            matchId={matchId}
            onPeerStats={update}
          />

          {match && (
            <div className="mt-4 bg-card rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">{match.league}</span>
                {match.status === 'live' && <LiveBadge />}
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>{match.homeTeam}</span>
                <span className="text-accent mx-4">{match.score || 'vs'}</span>
                <span>{match.awayTeam}</span>
              </div>
            </div>
          )}

          {/* P2P Stats */}
          <div className="mt-3 bg-card rounded-xl p-3 border border-white/5 flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {stats.peerCount} peer{stats.peerCount !== 1 ? 's' : ''} connected
            </span>
            <span>↓ {formatBytes(stats.downloadedFromPeers)} from peers</span>
            <span>↑ {formatBytes(stats.uploadedToPeers)} shared</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3 text-text-muted">Other Matches</h3>
          <div className="space-y-3">
            {related.map(m => (
              <Link
                key={m.id}
                href={`/watch/${m.id}`}
                className="block bg-card hover:bg-card-hover border border-white/5 rounded-lg p-3 transition"
              >
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>{m.league}</span>
                  {m.status === 'live' && <LiveBadge />}
                </div>
                <p className="text-sm font-medium">{m.homeTeam} vs {m.awayTeam}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

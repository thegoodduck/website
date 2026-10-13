import type { Match } from './types';
import { kooraLiveSource } from './sources/kooraLive';

const sources = [kooraLiveSource];

export async function scrapeAllMatches(): Promise<Match[]> {
  const results = await Promise.allSettled(sources.map(s => s.scrape()));
  const allMatches: Match[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const match of result.value) {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          allMatches.push(match);
        }
      }
    }
  }

  // Sort: live first, then by kickoff time
  allMatches.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });

  return allMatches;
}

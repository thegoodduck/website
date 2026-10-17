import type { Match, ScraperSource } from '../types';

const API = 'https://www.thesportsdb.com/api/v1/json/3';

// Major leagues to pull upcoming/recent fixtures for (TheSportsDB league ids)
const LEAGUE_IDS = ['4328', '4335', '4331', '4332', '4334', '4480', '4481', '4790'];

interface SportsDbEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  idLeague: string;
  strLeague: string;
  strSport?: string;
  strTimestamp?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/${path}`, {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapSport(sport?: string): Match['sport'] {
  switch (sport) {
    case 'Soccer': return 'football';
    case 'Basketball': return 'basketball';
    case 'Tennis': return 'tennis';
    default: return 'other';
  }
}

function toKickoff(e: SportsDbEvent): string {
  const raw = e.strTimestamp || (e.dateEvent ? `${e.dateEvent}T${e.strTime || '00:00:00'}` : '');
  // TheSportsDB timestamps are UTC without a zone suffix
  const d = new Date(raw.endsWith('Z') || /[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toStatus(e: SportsDbEvent, kickoff: string): Match['status'] {
  const s = (e.strStatus || '').toUpperCase();
  if (['FT', 'AET', 'PEN', 'FINISHED', 'MATCH FINISHED', 'CANC', 'PST', 'ABD'].includes(s)) return 'finished';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'IN PLAY'].includes(s) || /^\d+'?$/.test(s)) return 'live';
  if (s === 'NS' || s === 'NOT STARTED') return 'upcoming';
  // Unknown status: infer from kickoff time (football ≈ 2h window)
  const diff = Date.now() - new Date(kickoff).getTime();
  if (diff < 0) return 'upcoming';
  return diff < 2 * 60 * 60 * 1000 ? 'live' : 'finished';
}

function toMatch(e: SportsDbEvent): Match | null {
  if (!e.strHomeTeam || !e.strAwayTeam) return null;
  const kickoff = toKickoff(e);
  const status = toStatus(e, kickoff);
  const hasScore = e.intHomeScore != null && e.intAwayScore != null && status !== 'upcoming';
  return {
    id: `tsdb-${e.idEvent}`,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeTeamLogo: e.strHomeTeamBadge ? `${e.strHomeTeamBadge}/small` : undefined,
    awayTeamLogo: e.strAwayTeamBadge ? `${e.strAwayTeamBadge}/small` : undefined,
    league: e.strLeague,
    leagueId: e.idLeague,
    sport: mapSport(e.strSport),
    status,
    kickoff,
    score: hasScore ? `${e.intHomeScore} - ${e.intAwayScore}` : undefined,
    sourceUrl: `https://www.thesportsdb.com/event/${e.idEvent}`,
  };
}

function ymd(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export const theSportsDbSource: ScraperSource = {
  name: 'thesportsdb',
  async scrape() {
    const paths = [
      'livescore.php?s=Soccer',
      ...[-1, 0, 1, 2].map(d => `eventsday.php?d=${ymd(d)}&s=Soccer`),
      ...LEAGUE_IDS.map(id => `eventsnextleague.php?id=${id}`),
    ];

    const responses = await Promise.all(
      paths.map(p => getJson<{ events?: SportsDbEvent[]; livescore?: SportsDbEvent[] }>(p))
    );

    const out: Match[] = [];
    const seen = new Set<string>();
    for (const r of responses) {
      for (const e of [...(r?.events || []), ...(r?.livescore || [])]) {
        const m = toMatch(e);
        if (!m || seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
      }
    }
    // Drop matches that finished more than a day ago
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return out.filter(m => new Date(m.kickoff).getTime() > cutoff);
  },
};

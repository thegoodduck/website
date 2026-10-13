export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  leagueId: string;
  sport: 'football' | 'basketball' | 'tennis' | 'other';
  status: 'live' | 'upcoming' | 'finished';
  kickoff: string;
  score?: string;
  sourceUrl: string;
  channels?: string[];
}

export interface ScraperSource {
  name: string;
  scrape(): Promise<Match[]>;
}

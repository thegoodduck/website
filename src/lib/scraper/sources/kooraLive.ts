import * as cheerio from 'cheerio';
import type { Match, ScraperSource } from '../types';

const KOORA_URLS = [
  'https://kooralive.com',
  'https://kooora-live.com',
  'https://koooralive.com',
];

function hashId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

async function tryFetch(urls: string[]): Promise<{ html: string; baseUrl: string } | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return { html: await res.text(), baseUrl: url };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseMatches(html: string, baseUrl: string): Match[] {
  const $ = cheerio.load(html);
  const matches: Match[] = [];

  // Generic selectors that target common sports streaming site layouts
  $('[class*="match"], [class*="game"], [class*="event"], .fixture, tr[data-id], .item').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (text.length < 5) return;

    // Try to extract team names from common patterns
    const teams = $el.find('[class*="team"], [class*="home"], [class*="away"], td:nth-child(1), td:nth-child(3)');
    let homeTeam = '';
    let awayTeam = '';

    if (teams.length >= 2) {
      homeTeam = teams.eq(0).text().trim();
      awayTeam = teams.eq(1).text().trim();
    } else {
      // Try "Team A vs Team B" pattern
      const vsMatch = text.match(/(.+?)\s+(?:vs?\.?|[-–])\s+(.+?)(?:\s*\d|$)/i);
      if (vsMatch) {
        homeTeam = vsMatch[1].trim();
        awayTeam = vsMatch[2].trim();
      }
    }

    if (!homeTeam || !awayTeam) return;
    if (homeTeam.length > 50 || awayTeam.length > 50) return;

    // Extract league
    const league = $el.find('[class*="league"], [class*="competition"], [class*="tournament"]').first().text().trim()
      || $el.closest('[class*="league"], [class*="group"]').find('[class*="title"], h3, h4').first().text().trim()
      || 'Football';

    // Detect live status
    const isLive = $el.find('[class*="live"], .live, .on-air').length > 0
      || /\blive\b/i.test($el.attr('class') || '')
      || /\blive\b/i.test(text);

    // Extract score if live
    const scoreEl = $el.find('[class*="score"], [class*="result"]').first().text().trim();
    const scoreMatch = scoreEl.match(/(\d+)\s*[-–:]\s*(\d+)/);

    // Extract time
    const timeEl = $el.find('[class*="time"], [class*="date"], time').first().text().trim();
    const timeMatch = timeEl.match(/(\d{1,2}):(\d{2})/);

    // Try to find link to stream
    const link = $el.find('a').attr('href') || $el.closest('a').attr('href') || '';
    const sourceUrl = link.startsWith('http') ? link : link ? `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}` : baseUrl;

    // Extract logos
    const logos = $el.find('img[src*="team"], img[src*="logo"], img[src*="badge"]');
    const homeTeamLogo = logos.eq(0).attr('src') || undefined;
    const awayTeamLogo = logos.eq(1).attr('src') || undefined;

    const id = hashId(`${homeTeam}-${awayTeam}-${league}`);

    let kickoff = new Date().toISOString();
    if (timeMatch) {
      const now = new Date();
      now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
      kickoff = now.toISOString();
    }

    matches.push({
      id,
      homeTeam: homeTeam.slice(0, 40),
      awayTeam: awayTeam.slice(0, 40),
      homeTeamLogo,
      awayTeamLogo,
      league: league.slice(0, 60) || 'Football',
      leagueId: hashId(league || 'football'),
      sport: 'football',
      status: isLive ? 'live' : 'upcoming',
      kickoff,
      score: scoreMatch ? `${scoreMatch[1]} - ${scoreMatch[2]}` : undefined,
      sourceUrl,
    });
  });

  return matches;
}

export const kooraLiveSource: ScraperSource = {
  name: 'koora-live',
  async scrape() {
    const result = await tryFetch(KOORA_URLS);
    if (!result) return [];
    return parseMatches(result.html, result.baseUrl);
  },
};

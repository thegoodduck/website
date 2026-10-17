import type { Match } from './types';
import { theSportsDbSource } from './sources/theSportsDb';
import { kooraLiveSource } from './sources/kooraLive';

const sources = [theSportsDbSource, kooraLiveSource];

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(fc|sc|ac|as|ss|al|el)\s+/i, '')
    .replace(/\s+(fc|sc|ac|as|ss)$/i, '')
    .trim();
}

function teamNameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const common = wordsA.filter(w => wordsB.some(wb => wb === w || wb.includes(w) || w.includes(wb)));
  if (common.length === 0) return 0;
  return common.length / Math.max(wordsA.length, wordsB.length);
}

const KOORA_SITES = ['mediakorahd.com', 'kora-info.com', 'sportstv30.com', 'mobi-kora.com'];

function isExternalStream(url: string): boolean {
  if (!url) return false;
  if (url.includes('thesportsdb.com')) return false;
  return !KOORA_SITES.some(site => url.includes(site));
}

function hasArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

// Known nkoratv player URLs for beIN channels
const CHANNEL_STREAMS: Record<string, string> = {
  '1': 'https://top2.nkoratv.net/albaplayer/bein1/',
  '2': 'https://top2.nkoratv.net/albaplayer/bein2/',
  '3': 'https://top2.nkoratv.net/albaplayer/bein3/',
  '4': 'https://top2.nkoratv.net/albaplayer/bein4/',
  '5': 'https://top2.nkoratv.net/albaplayer/bein5/',
  '6': 'https://top2.nkoratv.net/albaplayer/bein6/',
  '7': 'https://top2.nkoratv.net/albaplayer/bein7/',
  '8': 'https://top2.nkoratv.net/albaplayer/bein8/',
  '9': 'https://top2.nkoratv.net/albaplayer/bein9/',
  'xtra1': 'https://top2.nkoratv.net/albaplayer/beinxtra1/',
  'xtra2': 'https://top2.nkoratv.net/albaplayer/beinxtra2/',
  'ontime': 'https://top2.nkoratv.net/albaplayer/ontime/',
};

function channelToStream(ch: string): string | null {
  const lower = ch.toLowerCase().replace(/\s+/g, ' ');
  // Match "beIN SPORTS HD 1", "BEIN SPORTS 1", "beIN Sport 8 HD", "Bein Sports HD2" etc.
  const beinMatch = lower.match(/bein\s*sports?\s*(?:hd\s*)?(?:xtra\s*)?(\d+)\s*(?:hd)?/i);
  if (beinMatch) {
    const isXtra = lower.includes('xtra');
    const num = beinMatch[1];
    const key = isXtra ? `xtra${num}` : num;
    return CHANNEL_STREAMS[key] || null;
  }
  // On Sport / On Time
  if (lower.includes('أون سبورت') || lower.includes('on sport') || lower.includes('ontime')) {
    return CHANNEL_STREAMS['ontime'] || null;
  }
  return null;
}

function mergeKooraLiveWithTSDB(kooraMatches: Match[], tsdbMatches: Match[]): Match[] {
  const merged: Match[] = [];
  const usedTsdb = new Set<string>();

  for (const klMatch of kooraMatches) {
    const klKickoff = new Date(klMatch.kickoff).getTime();

    let bestMatch: Match | null = null;
    let bestScore = 0;

    for (const tsdb of tsdbMatches) {
      if (usedTsdb.has(tsdb.id)) continue;
      const tsdbKickoff = new Date(tsdb.kickoff).getTime();
      const timeDiff = Math.abs(klKickoff - tsdbKickoff);
      if (timeDiff > 30 * 60 * 1000) continue;

      const homeSim = Math.max(
        teamNameSimilarity(klMatch.homeTeam, tsdb.homeTeam),
        teamNameSimilarity(klMatch.homeTeam, tsdb.awayTeam),
      );
      const awaySim = Math.max(
        teamNameSimilarity(klMatch.awayTeam, tsdb.awayTeam),
        teamNameSimilarity(klMatch.awayTeam, tsdb.homeTeam),
      );
      const nameSim = (homeSim + awaySim) / 2;
      if (nameSim < 0.3) continue;

      let score = nameSim * 10;
      if (klMatch.score && tsdb.score && klMatch.score === tsdb.score) score += 3;
      if (timeDiff < 5 * 60 * 1000) score += 2;
      else if (timeDiff < 15 * 60 * 1000) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = tsdb;
      }
    }

    if (bestMatch && bestScore >= 5) {
      usedTsdb.add(bestMatch.id);
      merged.push({
        ...bestMatch,
        sourceUrl: klMatch.sourceUrl || bestMatch.sourceUrl,
        channels: klMatch.channels || bestMatch.channels,
        score: klMatch.score || bestMatch.score,
        status: klMatch.status === 'live' ? 'live' : bestMatch.status,
      });
    } else {
      merged.push(klMatch);
    }
  }

  return merged;
}


export async function scrapeAllMatches(): Promise<Match[]> {
  const results = await Promise.allSettled(sources.map(s => s.scrape()));
  const sourceMatches: Match[][] = results.map(r => r.status === 'fulfilled' ? r.value : []);

  const [tsdbMatches, kooraMatches] = sourceMatches;

  // Merge Koora Live matches with TheSportsDB data
  const mergedKoora = mergeKooraLiveWithTSDB(kooraMatches || [], tsdbMatches || []);

  // Collect all matches, deduplicating by ID, team names, and sourceUrl
  const allMatches: Match[] = [];
  const seenIds = new Set<string>();
  const seenTeams = new Set<string>();
  const seenSources = new Set<string>();

  function teamKey(m: Match): string {
    return [normalize(m.homeTeam), normalize(m.awayTeam)].sort().join('|');
  }

  function addMatch(m: Match): boolean {
    if (seenIds.has(m.id)) return false;
    const tk = teamKey(m);
    if (seenTeams.has(tk)) return false;
    // Skip Arabic-named duplicates when we already have the same stream source
    if (isExternalStream(m.sourceUrl) && seenSources.has(m.sourceUrl) &&
        (hasArabic(m.homeTeam) || hasArabic(m.awayTeam))) {
      return false;
    }
    seenIds.add(m.id);
    seenTeams.add(tk);
    if (isExternalStream(m.sourceUrl)) seenSources.add(m.sourceUrl);
    allMatches.push(m);
    return true;
  }

  // Add merged Koora Live matches first (they have stream URLs)
  for (const m of mergedKoora) addMatch(m);

  // Add remaining TheSportsDB matches, enriching with stream URLs
  for (const m of (tsdbMatches || [])) {
    if (seenIds.has(m.id) || seenTeams.has(teamKey(m))) continue;

    let streamUrl = m.sourceUrl;
    const klWithStream = mergedKoora.find(kl =>
      isExternalStream(kl.sourceUrl) &&
      teamNameSimilarity(kl.homeTeam, m.homeTeam) > 0.5 &&
      teamNameSimilarity(kl.awayTeam, m.awayTeam) > 0.5
    );
    if (klWithStream) {
      streamUrl = klWithStream.sourceUrl;
    }

    addMatch({ ...m, sourceUrl: streamUrl });
  }

  // Assign channel-based streams to any match that has a known channel but no external stream
  for (const m of allMatches) {
    if (isExternalStream(m.sourceUrl)) continue;
    if (!m.channels) continue;
    for (const ch of m.channels) {
      const stream = channelToStream(ch);
      if (stream) {
        m.sourceUrl = stream;
        break;
      }
    }
  }

  // Only keep matches that have an actual external stream source
  // and are live or upcoming (finished matches no longer play on the channel)
  const streamable = allMatches.filter(m =>
    isExternalStream(m.sourceUrl) && m.status !== 'finished'
  );

  // Deduplicate same-match from different scraper sites:
  // two matches are duplicates if they share a sourceUrl AND kickoff within 30 min
  streamable.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });

  const finalMatches: Match[] = [];
  for (const m of streamable) {
    const isDupe = finalMatches.some(existing =>
      existing.sourceUrl === m.sourceUrl &&
      Math.abs(new Date(existing.kickoff).getTime() - new Date(m.kickoff).getTime()) < 30 * 60 * 1000
    );
    if (!isDupe) finalMatches.push(m);
  }

  return finalMatches;
}

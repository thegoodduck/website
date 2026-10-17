import type { Match, ScraperSource } from '../types';

// Free, ad-supported sports channels distributed openly by their owners (FIFA+, FAST services).
// Each URL was checked to return a valid HLS playlist; the source re-checks at scrape time
// so dead channels drop out automatically.
const CHANNELS: { id: string; name: string; description: string; url: string }[] = [
  { id: 'fifa-plus', name: 'FIFA+', description: 'Football', url: 'https://d2w9q46ikgrcwx.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-of5cbk3sav3w5/v1/sysdata_s_p_a_fifa_7/samsungheadend_us/latest/main/hls/playlist.m3u8' },
  { id: 'fifa-plus-es', name: 'FIFA+ Spain', description: 'Football', url: 'https://d63fabad.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWVzX0ZJRkFQbHVzU3BhbmlzaF9ITFM/playlist.m3u8' },
  { id: 'fifa-plus-fr', name: 'FIFA+ French', description: 'Football', url: 'https://37b4c228.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWZyX0ZJRkFQbHVzRnJlbmNoX0hMUw/playlist.m3u8' },
  { id: 'fifa-plus-de', name: 'FIFA+ German', description: 'Football', url: 'https://4397879b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/playlist.m3u8' },
  { id: 'fifa-plus-it', name: 'FIFA+ Italy', description: 'Football', url: 'https://5d95f7d7.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWl0X0ZJRkFQbHVzSXRhbGlhbl9ITFM/playlist.m3u8' },
  { id: 'golazo', name: 'CBS Sports Golazo Network', description: 'Football', url: 'https://dai.google.com/linear/hls/event/7f3Wv6f7QEKfQna22jHqLQ/master.m3u8' },
  { id: 'fubo-sports', name: 'Fubo Sports Network', description: 'Sports', url: 'https://dnf08l6u6uxnz.cloudfront.net/master.m3u8' },
  { id: 'flo-racing', name: 'FloRacing', description: 'Motorsport', url: 'https://amg02278-amg02278c1-flosports-worldwide-7592.playouts.now.amagi.tv/playlist.m3u8' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';

async function fetchText(url: string): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return { text: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function firstUri(playlist: string, base: string): string | null {
  const line = playlist.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
  if (!line) return null;
  try {
    return new URL(line, base).toString();
  } catch {
    return null;
  }
}

// Follows master -> media playlist -> first segment so channels that list fine but can't
// actually be fetched (expired tokens, blocked segments) are filtered out.
async function isAlive(url: string): Promise<boolean> {
  let current = url;
  for (let depth = 0; depth < 3; depth++) {
    const pl = await fetchText(current);
    if (!pl || !pl.text.trimStart().startsWith('#EXTM3U')) return false;
    const next = firstUri(pl.text, pl.finalUrl);
    if (!next) return false;
    if (!/\.m3u8(\?|$)/i.test(next) && !pl.text.includes('#EXT-X-STREAM-INF')) {
      try {
        const seg = await fetch(next, {
          headers: { 'User-Agent': UA, Range: 'bytes=0-1023' },
          signal: AbortSignal.timeout(6000),
        });
        return seg.ok || seg.status === 206;
      } catch {
        return false;
      }
    }
    current = next;
  }
  return false;
}

export const freeChannelsSource: ScraperSource = {
  name: 'free-channels',
  async scrape() {
    const alive = await Promise.all(CHANNELS.map(c => isAlive(c.url)));
    const now = new Date().toISOString();
    const out: Match[] = [];
    CHANNELS.forEach((c, i) => {
      if (!alive[i]) return;
      out.push({
        id: `ch-${c.id}`,
        homeTeam: c.name,
        awayTeam: '24/7 Channel',
        league: `Free Channels · ${c.description}`,
        leagueId: 'free-channels',
        sport: 'other',
        status: 'live',
        kickoff: now,
        sourceUrl: c.url,
      });
    });
    return out;
  },
};

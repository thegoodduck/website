import * as cheerio from 'cheerio';
import type { Match, ScraperSource } from '../types';

// Sites using the AY_Match WordPress theme structure
const AY_SITES = [
  'https://mediakorahd.com',
  'https://kora-info.com',
  'https://sportstv30.com',
];

// Sites using the elite-match-card structure
const ELITE_SITES = [
  'https://mobi-kora.com',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function hashStr(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function slugify(text: string): string {
  const ascii = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return ascii || hashStr(text);
}

// Arabic → English translation map for teams and leagues
const TEAM_MAP: Record<string, string> = {
  'ليفربول': 'Liverpool', 'مانشستر سيتي': 'Manchester City', 'باريس سان جيرمان': 'Paris Saint-Germain',
  'ريال مدريد': 'Real Madrid', 'روما': 'Roma', 'أستون فيلا': 'Aston Villa',
  'فنربخشة': 'Fenerbahce', 'فناربخشة': 'Fenerbahce', 'بوروسيا دورتموند': 'Borussia Dortmund',
  'دورتموند': 'Borussia Dortmund', 'بودو جليمت': 'Bodo/Glimt', 'بودو/غليمت': 'Bodo/Glimt',
  'شاختار دونيتسك': 'Shakhtar Donetsk', 'أيك أثينا': 'AEK Athens',
  'ريال بيتيس': 'Real Betis', 'بورتو': 'Porto', 'سلوفان براتيسلافا': 'Slovan Bratislava',
  'شتوتجارت': 'Stuttgart', 'فاينورد': 'Feyenoord', 'فينورد روتردام': 'Feyenoord',
  'كومو': 'Como', 'لاسك لينز': 'LASK', 'لاسك': 'LASK',
  'الفتح الرباطي': 'FUS Rabat', 'الفتح الرياضي': 'FUS Rabat',
  'الرجاء البيضاوي': 'Raja Casablanca', 'الرجاء الرياضي': 'Raja Casablanca',
  'ناساف كارشي': 'Nasaf Karshi', 'الوحدة': 'Al Wahda', 'الاتفاق': 'Al Ittifaq',
  'كاظمة': 'Kazma', 'الدحيل': 'Al Duhail', 'الشباب': 'Al Shabab',
  'عجمان': 'Ajman', 'أربيل': 'Erbil', 'التعاون': 'Al Taawon',
  'الريان': 'Al Rayyan', 'الجزيرة': 'Al Jazira', 'أركاداج': 'Arkadag',
  'الفيصلي': 'Al Faisaly', 'النهضة': 'Al Nahda', 'الكويت': 'Kuwait SC',
  'الخالدية': 'Al Khaldiya', 'السد': 'Al Sadd', 'الهلال': 'Al Hilal',
  'اتحاد طنجة': 'Ittihad Tanger', 'المغرب الفاسي': 'Maghreb de Fes',
  'لانس': 'Lens', 'سبورتنج لشبونة': 'Sporting CP', 'صباح': 'Sabah FK',
  'سلافيا براغ': 'Slavia Prague', 'إيست بنغال': 'East Bengal', 'الشرطة': 'Al Shorta',
  'البنك الاهلي': 'National Bank', 'طلائع الجيش': 'Tala\'ea El-Gaish',
  'الاتحاد السكندري': 'Al Ittihad Alexandria', 'الجونة': 'El Gouna',
  'برشلونة': 'Barcelona', 'بايرن ميونخ': 'Bayern Munich', 'يوفنتوس': 'Juventus',
  'ميلان': 'AC Milan', 'إنتر ميلان': 'Inter Milan', 'تشيلسي': 'Chelsea',
  'أرسنال': 'Arsenal', 'توتنهام': 'Tottenham', 'مانشستر يونايتد': 'Manchester United',
  'أتلتيكو مدريد': 'Atletico Madrid', 'نابولي': 'Napoli',
  'السيب': 'Al Seeb', 'الحسين إربد': 'Al Hussein Irbid',
  'بترول اسيوط': 'Petrojet', 'ابو قير للاسمدة': 'Abu Qir Fertilizers',
  'وفاق سطيف': 'ES Setif', 'شبيبة القبائل': 'JS Kabylie',
  'مستقبل الرويسات': 'MC Rouissat', 'تموشنت': 'WA Tlemcen',
  // Short-form Arabic names (mobi-kora)
  'شاختار': 'Shakhtar Donetsk', 'براتيسلافا': 'Slovan Bratislava',
  'مان سيتي': 'Manchester City', 'باريس': 'Paris Saint-Germain',
  'بيتيس': 'Real Betis', 'فيلا': 'Aston Villa',
  'فنربخشه': 'Fenerbahce', 'بودو غليمت': 'Bodo/Glimt',
};

const LEAGUE_MAP: Record<string, string> = {
  'أوروبا, دوري أبطال اوروبا': 'UEFA Champions League',
  'دوري أبطال أوروبا': 'UEFA Champions League',
  'آسيا, دوري أبطال آسيا 2': 'AFC Champions League 2',
  'دوري أبطال الخليج': 'Gulf Champions League',
  'المغرب, الدوري المغربي': 'Moroccan Championship',
  'البطولة الوطنية المغربية': 'Moroccan Championship',
  'الرابطة المحترفة الجزائرية': 'Algerian Ligue 1',
  'الدوري المصري': 'Egyptian Premier League',
  'دوري أبطال أفريقيا': 'CAF Champions League',
};

function translateName(name: string): string {
  return TEAM_MAP[name] || name;
}

function translateLeague(league: string): string {
  return LEAGUE_MAP[league] || league;
}

interface ParsedMatch {
  team1: string;
  team2: string;
  time: string;
  kickoff: string | undefined;
  score: string | undefined;
  status: 'live' | 'upcoming' | 'finished';
  league: string;
  channel: string | undefined;
  streamUrl: string | undefined;
  matchPageUrl: string | undefined;
}

function parseAYMatches(html: string, baseUrl: string): ParsedMatch[] {
  const $ = cheerio.load(html);
  const matches: ParsedMatch[] = [];

  $('.AY_Match').each((_i, el) => {
    const $el = $(el);
    const team1 = $el.find('.TM1 .TM_Name').text().trim();
    const team2 = $el.find('.TM2 .TM_Name').text().trim();
    if (!team1 || !team2) return;

    const time = $el.find('.MT_Time').text().trim();
    const goals = $el.find('.RS-goals').map((_j, g) => $(g).text().trim()).get();
    const statText = $el.find('.MT_Stat').text().trim();

    const classes = $el.attr('class') || '';
    let status: ParsedMatch['status'] = 'upcoming';
    if (classes.includes('live')) status = 'live';
    else if (classes.includes('finished')) status = 'finished';
    else if (statText.includes('جارية') || statText.includes('مباشر')) status = 'live';
    else if (statText.includes('انتهت')) status = 'finished';

    const score = status !== 'upcoming' && goals.length >= 2
      ? `${goals[0]} - ${goals[1]}`
      : undefined;

    const infoItems = $el.find('.MT_Info li span').map((_j, s) => $(s).text().trim()).get();
    const channel = infoItems[0] || undefined;
    const league = infoItems[2] || infoItems[1] || '';

    const linkEl = $el.find('a').first();
    const linkHref = linkEl.attr('href') || '';
    const linkTitle = linkEl.attr('title') || '';
    let streamUrl: string | undefined;
    let matchPageUrl: string | undefined;

    if (linkHref) {
      const absoluteLink = linkHref.startsWith('http') ? linkHref : new URL(linkHref, baseUrl).toString();
      const baseHost = new URL(baseUrl).hostname;
      if (new URL(absoluteLink).hostname === baseHost && absoluteLink.includes('/matches/')) {
        matchPageUrl = absoluteLink;
      } else if (absoluteLink !== baseUrl && new URL(absoluteLink).hostname !== baseHost) {
        streamUrl = absoluteLink;
      }
    }

    // Extract date from title like "... بتاريخ 2026-10-14 ..."
    const dateMatch = linkTitle.match(/(\d{4}-\d{2}-\d{2})/);
    let kickoff: string | undefined;
    if (dateMatch && time) {
      const [h, m] = time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        kickoff = `${dateMatch[1]}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+02:00`;
      }
    }

    matches.push({ team1, team2, time, kickoff, score, status, league, channel, streamUrl, matchPageUrl });
  });

  return matches;
}

function parseEliteMatches(html: string, _baseUrl: string): ParsedMatch[] {
  const $ = cheerio.load(html);
  const matches: ParsedMatch[] = [];

  $('a.elite-match-card').each((_i, el) => {
    const $el = $(el);
    const team1 = $el.find('.home-team .team-name-zn').text().trim();
    const team2 = $el.find('.away-team .team-name-zn').text().trim();
    if (!team1 || !team2) return;

    const datetime = $el.attr('data-datetime') || '';
    const homeScore = $el.find('.s-home').text().trim();
    const awayScore = $el.find('.s-away').text().trim();
    const statusText = $el.find('.status-zn').text().trim();
    const classes = $el.attr('class') || '';

    let status: ParsedMatch['status'] = 'upcoming';
    if (classes.includes('status-live') || statusText.includes('جارية') || statusText.includes('مباشر')) status = 'live';
    else if (classes.includes('status-finished') || statusText.includes('انتهت')) status = 'finished';

    const score = status !== 'upcoming' && homeScore && awayScore
      ? `${homeScore} - ${awayScore}`
      : undefined;

    const leagueRaw = $el.find('.league-zn').text().trim().replace(/^🏆\s*/, '');
    const channelRaw = $el.find('.channel-zn').text().trim().replace(/^📺\s*/, '');
    const channel = channelRaw && !channelRaw.includes('غير محددة') ? channelRaw : undefined;

    const href = $el.attr('href') || '';
    let streamUrl: string | undefined;
    let matchPageUrl: string | undefined;
    if (href && href !== '/' && href.startsWith('http')) {
      streamUrl = href;
    }

    const time = datetime ? new Date(datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Cairo' }) : '';

    matches.push({ team1, team2, time, kickoff: datetime || undefined, score, status, league: leagueRaw, channel, streamUrl, matchPageUrl });
  });

  return matches;
}

function toMatchId(team1: string, team2: string): string {
  return `kl-${slugify(team1)}-${slugify(team2)}`.substring(0, 80);
}

function toISO(time: string): string {
  if (!time) return new Date().toISOString();
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return new Date().toISOString();
  const d = new Date();
  d.setUTCHours(h - 2, m, 0, 0);
  return d.toISOString();
}

export const kooraLiveSource: ScraperSource = {
  name: 'koora-live',
  async scrape() {
    const out: Match[] = [];
    const seen = new Set<string>();

    const addMatch = (pm: ParsedMatch, site: string) => {
      const t1 = translateName(pm.team1);
      const t2 = translateName(pm.team2);
      const id = toMatchId(t1, t2);
      if (seen.has(id)) {
        if (pm.streamUrl) {
          const existing = out.find(m => m.id === id);
          if (existing && (existing.sourceUrl.includes('mediakorahd') || existing.sourceUrl.includes('kora-info') || existing.sourceUrl.includes('sportstv30'))) {
            existing.sourceUrl = pm.streamUrl;
          }
        }
        return;
      }
      seen.add(id);
      const kickoff = pm.kickoff ? new Date(pm.kickoff).toISOString() : toISO(pm.time);
      out.push({
        id,
        homeTeam: t1,
        awayTeam: t2,
        league: translateLeague(pm.league),
        leagueId: `kl-${slugify(translateLeague(pm.league))}`,
        sport: 'football',
        status: pm.status,
        kickoff,
        score: pm.score,
        sourceUrl: pm.streamUrl || pm.matchPageUrl || site,
        channels: pm.channel ? [pm.channel] : undefined,
      });
    };

    // Scrape AY_Match sites
    const ayPages = AY_SITES.flatMap(site => [
      { url: site, site },
      { url: `${site}/matches-yesterday/`, site },
    ]);
    const ayHtmls = await Promise.all(ayPages.map(p => fetchHTML(p.url).then(html => ({ html, site: p.site }))));
    for (const { html, site } of ayHtmls) {
      if (!html) continue;
      for (const pm of parseAYMatches(html, site)) {
        addMatch(pm, site);
      }
    }

    // Scrape Elite sites
    const eliteHtmls = await Promise.all(ELITE_SITES.map(site => fetchHTML(site).then(html => ({ html, site }))));
    for (const { html, site } of eliteHtmls) {
      if (!html) continue;
      for (const pm of parseEliteMatches(html, site)) {
        addMatch(pm, site);
      }
    }

    return out;
  },
};

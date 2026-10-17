import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { cacheGet, cacheSet } from '@/lib/cache';
import { scrapeAllMatches } from '@/lib/scraper';
import { assertPublicUrl, safeFetch } from '@/lib/ssrf';
import type { Match } from '@/lib/scraper/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface StreamResult {
  type: 'hls' | 'youtube' | 'embed';
  url: string;
}

const KOORA_HOSTS = ['mediakorahd.com', 'kora-info.com', 'sportstv30.com', 'mobi-kora.com'];

async function isSafeUrl(url: string): Promise<boolean> {
  try {
    await assertPublicUrl(url);
    return true;
  } catch {
    return false;
  }
}

function isStreamPlayerDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (['www.thesportsdb.com', 'thesportsdb.com'].includes(host)) return false;
    if (KOORA_HOSTS.some(h => host.includes(h))) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolveStreamUrl(sourceUrl: string, depth = 0): Promise<StreamResult | null> {
  if (depth > 4) return null;
  if (!(await isSafeUrl(sourceUrl))) return null;

  if (/\.m3u8(\?|$)/i.test(sourceUrl)) {
    const check = await safeFetch(sourceUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (check?.ok) return { type: 'hls', url: sourceUrl };
    return null;
  }

  if (/youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch/.test(sourceUrl)) {
    const videoId = sourceUrl.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) return { type: 'youtube', url: videoId };
  }

  try {
    const res = await safeFetch(sourceUrl, {
      headers: { 'User-Agent': UA, 'Referer': new URL(sourceUrl).origin + '/' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      // If fetch fails but the URL looks like a player page, embed it directly
      if (depth > 0 && isStreamPlayerDomain(sourceUrl)) {
        return { type: 'embed', url: sourceUrl };
      }
      return null;
    }

    const finalUrl = res.finalUrl;
    const html = await res.text();

    // Detect redirect to Google (bot detection)
    if (finalUrl.includes('google.com') || html.includes('google.com/search')) {
      if (isStreamPlayerDomain(sourceUrl)) {
        return { type: 'embed', url: sourceUrl };
      }
      return null;
    }

    const $ = cheerio.load(html);

    // Check for YouTube embeds
    const ytIframe = $('iframe[src*="youtube.com/embed"], iframe[src*="youtu.be"]').first().attr('src');
    if (ytIframe) {
      const videoId = ytIframe.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (videoId) return { type: 'youtube', url: videoId };
    }

    // Look for m3u8 URLs
    const m3u8Patterns = [
      /['"]([^'"]*\.m3u8[^'"]*)['"]/gi,
      /source\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
      /file\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
      /src\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
      /hls\.loadSource\(['"]([^'"]+)['"]\)/gi,
    ];

    for (const pattern of m3u8Patterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const url = match[1];
        if (url?.includes('.m3u8')) {
          const absolute = url.startsWith('http') ? url : new URL(url, finalUrl).toString();
          if (!(await isSafeUrl(absolute))) continue;
          const check = await safeFetch(absolute, {
            method: 'HEAD',
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);
          if (check?.ok) return { type: 'hls', url: absolute };
        }
      }
    }

    // Dailymotion embeds
    const dmIframe = $('iframe[src*="dailymotion.com/embed"]').first().attr('src');
    if (dmIframe) return { type: 'embed', url: dmIframe };

    // Follow iframes recursively
    const iframeSrc = $('iframe[src]').first().attr('src');
    if (iframeSrc) {
      const iframeUrl = iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, finalUrl).toString();
      const result = await resolveStreamUrl(iframeUrl, depth + 1);
      if (result) return result;
    }

    // Check for stream player links in Koora Live pages
    const streamLink = $('a[href*="player"], a[href*="stream"], a[href*="embed"], a[href*="nkoratv"], a[href*="albaplayer"], a[href*="hdshoto"], a[href*="korhd"]').first().attr('href');
    if (streamLink) {
      const absolute = streamLink.startsWith('http') ? streamLink : new URL(streamLink, finalUrl).toString();
      const result = await resolveStreamUrl(absolute, depth + 1);
      if (result) return result;
    }

    // If this page looks like a player page (has video elements, player divs, etc.)
    // but we couldn't extract the stream, embed it directly
    const hasPlayerElements = $('video, .player, #player, .video-player, [class*="player"], .jwplayer, .clappr').length > 0;
    if (hasPlayerElements && isStreamPlayerDomain(sourceUrl)) {
      return { type: 'embed', url: sourceUrl };
    }

    return null;
  } catch {
    // Network error but URL looks like a player — embed it
    if (depth > 0 && isStreamPlayerDomain(sourceUrl)) {
      return { type: 'embed', url: sourceUrl };
    }
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const { matchId } = params;

  const cacheKey = `stream-${matchId}`;
  const cached = cacheGet<StreamResult>(cacheKey);
  if (cached) {
    return await respondWithResult(cached);
  }

  const matches = cacheGet<Match[]>('matches') || await scrapeAllMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const result = await resolveStreamUrl(match.sourceUrl);
  if (!result) {
    // Last resort: if the sourceUrl itself is an external player URL, embed it
    if (isStreamPlayerDomain(match.sourceUrl) && !match.sourceUrl.includes('thesportsdb.com')) {
      const fallback: StreamResult = { type: 'embed', url: match.sourceUrl };
      cacheSet(cacheKey, fallback, 180_000);
      return await respondWithResult(fallback);
    }
    return NextResponse.json({ error: 'Stream not available yet' }, { status: 404 });
  }

  cacheSet(cacheKey, result, 300_000);
  return await respondWithResult(result);
}

async function respondWithResult(result: StreamResult) {
  switch (result.type) {
    case 'youtube':
      return NextResponse.json({ streamUrl: null, youtubeId: result.url });
    case 'embed': {
      if (!(await isSafeUrl(result.url))) return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 });
      return NextResponse.json({ streamUrl: null, embedUrl: result.url });
    }
    case 'hls': {
      if (!(await isSafeUrl(result.url))) return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 });
      return NextResponse.json({ streamUrl: `/api/proxy?url=${encodeURIComponent(result.url)}` });
    }
  }
}

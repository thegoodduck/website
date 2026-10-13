import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { cacheGet, cacheSet } from '@/lib/cache';
import { scrapeAllMatches } from '@/lib/scraper';
import type { Match } from '@/lib/scraper/types';

async function resolveStreamUrl(sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(sourceUrl).origin + '/',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Look for m3u8 URLs in the page
    const m3u8Patterns = [
      /['"]([^'"]*\.m3u8[^'"]*)['"]/gi,
      /source\s*[:=]\s*['"]([^'"]+)['"]/gi,
      /file\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
      /src\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
      /hls\.loadSource\(['"]([^'"]+)['"]\)/gi,
    ];

    for (const pattern of m3u8Patterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const url = match[1];
        if (url && url.includes('.m3u8')) {
          return url.startsWith('http') ? url : `${new URL(sourceUrl).origin}${url.startsWith('/') ? '' : '/'}${url}`;
        }
      }
    }

    // Check for iframes that might contain the stream
    const $ = cheerio.load(html);
    const iframeSrc = $('iframe[src*="embed"], iframe[src*="stream"], iframe[src*="player"]').first().attr('src');
    if (iframeSrc) {
      const iframeUrl = iframeSrc.startsWith('http') ? iframeSrc : `${new URL(sourceUrl).origin}${iframeSrc}`;
      return resolveStreamUrl(iframeUrl);
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const cacheKey = `stream-${matchId}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) {
    return NextResponse.json({ streamUrl: `/api/proxy?url=${encodeURIComponent(cached)}` });
  }

  const matches = cacheGet<Match[]>('matches') || await scrapeAllMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const streamUrl = await resolveStreamUrl(match.sourceUrl);
  if (!streamUrl) {
    return NextResponse.json({ error: 'Stream not available yet' }, { status: 404 });
  }

  cacheSet(cacheKey, streamUrl, 300_000); // cache 5 min
  return NextResponse.json({ streamUrl: `/api/proxy?url=${encodeURIComponent(streamUrl)}` });
}

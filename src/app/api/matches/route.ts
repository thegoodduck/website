import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllMatches } from '@/lib/scraper';
import { cacheGet, cacheSet } from '@/lib/cache';
import type { Match } from '@/lib/scraper/types';

const CACHE_KEY = 'matches';
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const league = searchParams.get('league');
  const status = searchParams.get('status');

  let matches = cacheGet<Match[]>(CACHE_KEY);
  if (!matches) {
    matches = await scrapeAllMatches();
    cacheSet(CACHE_KEY, matches, CACHE_TTL);
  }

  let filtered = matches;
  if (league) filtered = filtered.filter(m => m.leagueId === league);
  if (status) filtered = filtered.filter(m => m.status === status);

  return NextResponse.json(filtered);
}

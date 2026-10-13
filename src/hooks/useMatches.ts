'use client';

import useSWR from 'swr';
import type { Match } from '@/lib/scraper/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useMatches(params?: { league?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.league) query.set('league', params.league);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();

  const { data, error, isLoading } = useSWR<Match[]>(
    `/api/matches${qs ? `?${qs}` : ''}`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  return { matches: data || [], isLoading, error };
}

'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useStream(matchId: string) {
  const { data, error, isLoading } = useSWR<{
    streamUrl?: string;
    youtubeId?: string;
    embedUrl?: string;
    error?: string;
  }>(
    `/api/stream/${matchId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    streamUrl: data?.streamUrl || null,
    youtubeId: data?.youtubeId || null,
    embedUrl: data?.embedUrl || null,
    isLoading,
    error: error || (data?.error ? new Error(data.error) : null),
  };
}

'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useStream(matchId: string) {
  const { data, error, isLoading } = useSWR<{ streamUrl?: string; error?: string }>(
    `/api/stream/${matchId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    streamUrl: data?.streamUrl || null,
    isLoading,
    error: error || (data?.error ? new Error(data.error) : null),
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PeerStats {
  peerCount: number;
  downloadedFromPeers: number;
  uploadedToPeers: number;
}

export function usePeerStats() {
  const [stats, setStats] = useState<PeerStats>({
    peerCount: 0,
    downloadedFromPeers: 0,
    uploadedToPeers: 0,
  });

  const update = useCallback((partial: Partial<PeerStats>) => {
    setStats(prev => ({ ...prev, ...partial }));
  }, []);

  return { stats, update };
}

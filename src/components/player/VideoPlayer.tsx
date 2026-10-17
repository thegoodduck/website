'use client';

import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import { PlayerControls } from './PlayerControls';
import { PlayerOverlay } from './PlayerOverlay';
import { PeerMesh } from '@/lib/p2p/PeerMesh';
import { SegmentCache } from '@/lib/p2p/SegmentCache';
import { createP2PLoader } from '@/lib/p2p/P2PLoader';

interface Props {
  streamUrl: string | null;
  youtubeId?: string | null;
  embedUrl?: string | null;
  matchId: string;
  onPeerStats?: (stats: { peerCount: number; downloaded: number; uploaded: number }) => void;
}

export function VideoPlayer({ streamUrl, youtubeId, embedUrl, matchId, onPeerStats }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const meshRef = useRef<PeerMesh | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    if (youtubeId || embedUrl) {
      setLoading(false);
      return;
    }

    if (!streamUrl || !videoRef.current) {
      setLoading(false);
      return;
    }

    const video = videoRef.current;
    setLoading(true);
    setError(null);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadeddata', () => setLoading(false), { once: true });
      video.addEventListener('error', () => { setError('Failed to load stream'); setLoading(false); }, { once: true });
      return;
    }

    if (!Hls.isSupported()) {
      setError('HLS is not supported in this browser');
      setLoading(false);
      return;
    }

    const cache = new SegmentCache();
    let mesh: PeerMesh | null = null;

    try {
      mesh = new PeerMesh(matchId, cache, (stats) => {
        setPeerCount(stats.peerCount);
        onPeerStats?.(stats);
      });
      mesh.start();
      meshRef.current = mesh;
    } catch {
      // P2P failed to init — continue without it
    }

    const P2PLoaderClass = createP2PLoader(mesh, cache);

    const hls = new Hls({
      fLoader: P2PLoaderClass as any,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });
    hlsRef.current = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false);
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setError('Stream playback failed');
            setLoading(false);
            hls.destroy();
            break;
        }
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
      mesh?.destroy();
      meshRef.current = null;
    };
  }, [streamUrl, youtubeId, embedUrl, matchId, onPeerStats]);

  if (youtubeId) {
    return (
      <div className="player-container relative bg-black rounded-xl overflow-hidden aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (embedUrl && /^https?:\/\//i.test(embedUrl)) {
    return (
      <div className="player-container relative bg-black rounded-xl overflow-hidden aspect-video w-full">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className="player-container relative bg-black rounded-xl overflow-hidden aspect-video w-full">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        autoPlay
      />
      <PlayerOverlay
        loading={loading}
        error={streamUrl ? error : null}
        upcoming={!streamUrl && !error}
      />
      <PlayerControls videoRef={videoRef} peerCount={peerCount} />
    </div>
  );
}

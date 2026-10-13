'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  peerCount: number;
}

export function PlayerControls({ videoRef, peerCount }: Props) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration || 0);
    const onVolume = () => { setVolume(video.volume); setMuted(video.muted); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('volumechange', onVolume);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('volumechange', onVolume);
    };
  }, [videoRef]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const changeVolume = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
  };

  const toggleFullscreen = () => {
    const container = containerRef.current?.closest('.player-container');
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      container.requestFullscreen();
      setFullscreen(true);
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
      {/* Progress bar */}
      {duration > 0 && (
        <div className="w-full h-1 bg-white/20 rounded mb-3 cursor-pointer" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          if (videoRef.current) videoRef.current.currentTime = pct * duration;
        }}>
          <div className="h-full bg-accent rounded" style={{ width: `${(currentTime / duration) * 100}%` }} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="text-xl hover:text-accent transition">
          {playing ? '⏸' : '▶'}
        </button>

        <button onClick={toggleMute} className="text-sm hover:text-accent transition">
          {muted || volume === 0 ? '🔇' : '🔊'}
        </button>

        <input
          type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
          onChange={e => changeVolume(parseFloat(e.target.value))}
          className="w-20 accent-accent"
        />

        <span className="text-xs text-text-muted ml-auto">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {peerCount > 0 && (
          <span className="text-xs text-accent flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {peerCount} peer{peerCount !== 1 ? 's' : ''}
          </span>
        )}

        <button onClick={toggleFullscreen} className="text-sm hover:text-accent transition">
          {fullscreen ? '⊡' : '⛶'}
        </button>
      </div>
    </div>
  );
}

'use client';

interface Props {
  loading: boolean;
  error: string | null;
  upcoming?: boolean;
}

export function PlayerOverlay({ loading, error, upcoming }: Props) {
  if (!loading && !error && !upcoming) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
      {loading && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading stream...</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <p className="text-accent-red font-semibold">Stream Unavailable</p>
          <p className="text-sm text-text-muted max-w-sm">{error}</p>
        </div>
      )}
      {upcoming && !error && !loading && (
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">⏳</span>
          <p className="text-text-muted">Stream starting soon...</p>
        </div>
      )}
    </div>
  );
}

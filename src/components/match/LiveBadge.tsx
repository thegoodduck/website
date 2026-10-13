export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-accent-red/20 text-accent-red text-xs font-bold px-2 py-0.5 rounded-full">
      <span className="w-2 h-2 rounded-full bg-accent-red animate-pulse-live" />
      LIVE
    </span>
  );
}

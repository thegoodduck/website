export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

export function MatchCardSkeleton() {
  return (
    <div className="bg-card border border-white/5 rounded-xl p-4">
      <Skeleton className="h-3 w-24 mb-4" />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

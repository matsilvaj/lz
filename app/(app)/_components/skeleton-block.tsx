export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[24px] border border-white/8 bg-white/5 ${className}`}
    />
  );
}

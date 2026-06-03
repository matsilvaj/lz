function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[24px] border border-white/8 bg-white/5 ${className}`}
    />
  );
}

export default function MonitorOddsEventLoading() {
  return (
    <div className="space-y-5" aria-label="Carregando odds do evento">
      <section className="lz-panel rounded-[32px] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="mt-2 h-8 w-64 rounded-full" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[560px]">
            <SkeletonBlock className="h-12 rounded-full" />
            <SkeletonBlock className="h-12 rounded-full" />
            <SkeletonBlock className="h-12 rounded-full" />
          </div>
        </div>
      </section>

      <section className="lz-panel rounded-[28px] p-4 md:p-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-24 rounded-full" />
              <SkeletonBlock className="h-7 w-52 rounded-full" />
            </div>
            <SkeletonBlock className="mt-4 h-8 w-full max-w-xl rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-11 w-full rounded-full sm:w-28" />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonBlock className="h-[360px]" />
        <SkeletonBlock className="h-[360px]" />
      </div>
    </div>
  );
}

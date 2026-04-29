function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[24px] border border-white/8 bg-white/5 ${className}`}
    />
  );
}

export default function AppLoading() {
  return (
    <div className="space-y-5" aria-label="Carregando">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock className="h-32" key={index} />
        ))}
      </div>

      <div className="lz-panel flex flex-col gap-3 rounded-[28px] px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock className="h-10 w-32 rounded-full" key={index} />
          ))}
        </div>

        <SkeletonBlock className="h-10 w-full rounded-full sm:w-64" />
      </div>

      <section className="lz-panel space-y-4 rounded-[28px] p-5 md:p-6">
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-44 rounded-full" />
          <SkeletonBlock className="h-4 w-32 rounded-full" />
        </div>

        <SkeletonBlock className="h-[240px] sm:h-[280px] lg:h-[320px]" />
      </section>
    </div>
  );
}

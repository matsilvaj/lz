type ComingSoonPageProps = {
  title: string;
  message: string;
  variant?: "odds" | "double-monitor";
};

function OddsBackdrop() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white/90 px-5 py-4 shadow-sm">
        <div className="h-11 w-48 rounded-xl bg-neutral-200" />
        <div className="flex gap-3">
          <div className="h-11 w-32 rounded-xl bg-neutral-200" />
          <div className="h-11 w-24 rounded-xl bg-neutral-200" />
        </div>
      </div>

      <div className="h-12 rounded-2xl border border-neutral-200 bg-white/90 shadow-sm" />

      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(90px,0.24fr))_88px] items-center gap-4 rounded-2xl border border-neutral-200 bg-white/92 px-5 py-5 shadow-sm"
          key={`odds-card-${index}`}
        >
          <div className="space-y-3">
            <div className="h-5 w-52 rounded-full bg-neutral-300" />
            <div className="h-4 w-40 rounded-full bg-neutral-200" />
            <div className="h-4 w-24 rounded-full bg-neutral-200" />
          </div>

          {Array.from({ length: 3 }).map((__, oddIndex) => (
            <div className="space-y-3 text-center" key={`odd-${index}-${oddIndex}`}>
              <div className="mx-auto h-3 w-12 rounded-full bg-neutral-200" />
              <div className="mx-auto h-7 w-14 rounded-lg bg-neutral-300" />
              <div className="mx-auto h-3 w-16 rounded-full bg-neutral-200" />
            </div>
          ))}

          <div className="flex justify-end">
            <div className="h-12 w-16 rounded-xl bg-neutral-300" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DoubleMonitorBackdrop() {
  return (
    <div className="space-y-5 p-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="h-12 rounded-2xl border border-neutral-200 bg-white/90 shadow-sm" />
        <div className="h-12 rounded-2xl border border-neutral-200 bg-white/90 shadow-sm" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="rounded-2xl border border-neutral-200 bg-white/92 px-5 py-5 shadow-sm"
            key={`double-card-${index}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="h-5 w-44 rounded-full bg-neutral-300" />
                <div className="h-4 w-32 rounded-full bg-neutral-200" />
              </div>

              <div className="h-8 w-20 rounded-full bg-neutral-300" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-4"
                  key={`double-metric-${index}-${metricIndex}`}
                >
                  <div className="mx-auto h-3 w-12 rounded-full bg-neutral-200" />
                  <div className="mx-auto mt-3 h-6 w-14 rounded-lg bg-neutral-300" />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="h-10 w-36 rounded-xl bg-neutral-200" />
              <div className="h-10 w-24 rounded-xl bg-neutral-300" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComingSoonPage({
  title,
  message,
  variant = "odds",
}: ComingSoonPageProps) {
  return (
    <section className="relative isolate min-h-[calc(100vh-180px)] overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-sm">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-90 blur-[2px]">
          {variant === "double-monitor" ? <DoubleMonitorBackdrop /> : <OddsBackdrop />}
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.88))]" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-180px)] items-center justify-center px-6 py-12">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-neutral-950 md:text-6xl">
            Em breve
          </h1>

          <p className="mt-4 text-xl font-medium text-neutral-800 md:text-2xl">
            {title}
          </p>

          <div className="mt-8 inline-flex rounded-full border border-neutral-200 bg-white/95 px-5 py-3 text-sm text-neutral-700 shadow-sm">
            {message}
          </div>
        </div>
      </div>
    </section>
  );
}

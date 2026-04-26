type ComingSoonPageProps = {
  title: string;
  message: string;
  variant?: "odds" | "double-monitor";
};

function OddsBackdrop() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-white/8 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
        <div className="h-11 w-48 rounded-xl bg-white/12" />
        <div className="flex gap-3">
          <div className="h-11 w-32 rounded-xl bg-white/12" />
          <div className="h-11 w-24 rounded-xl bg-white/12" />
        </div>
      </div>

      <div className="h-12 rounded-[26px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(90px,0.24fr))_88px] items-center gap-4 rounded-[26px] border border-white/10 bg-white/8 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          key={`odds-card-${index}`}
        >
          <div className="space-y-3">
            <div className="h-5 w-52 rounded-full bg-white/14" />
            <div className="h-4 w-40 rounded-full bg-white/10" />
            <div className="h-4 w-24 rounded-full bg-white/10" />
          </div>

          {Array.from({ length: 3 }).map((__, oddIndex) => (
            <div className="space-y-3 text-center" key={`odd-${index}-${oddIndex}`}>
              <div className="mx-auto h-3 w-12 rounded-full bg-white/10" />
              <div className="mx-auto h-7 w-14 rounded-lg bg-white/14" />
              <div className="mx-auto h-3 w-16 rounded-full bg-white/10" />
            </div>
          ))}

          <div className="flex justify-end">
            <div className="h-12 w-16 rounded-xl bg-white/14" />
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
        <div className="h-12 rounded-[26px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" />
        <div className="h-12 rounded-[26px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="rounded-[26px] border border-white/10 bg-white/8 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
            key={`double-card-${index}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="h-5 w-44 rounded-full bg-white/14" />
                <div className="h-4 w-32 rounded-full bg-white/10" />
              </div>

              <div className="h-8 w-20 rounded-full bg-white/14" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div
                  className="rounded-xl border border-white/10 bg-white/6 px-3 py-4"
                  key={`double-metric-${index}-${metricIndex}`}
                >
                  <div className="mx-auto h-3 w-12 rounded-full bg-white/10" />
                  <div className="mx-auto mt-3 h-6 w-14 rounded-lg bg-white/14" />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="h-10 w-36 rounded-xl bg-white/10" />
              <div className="h-10 w-24 rounded-xl bg-white/14" />
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
    <section className="lz-panel relative isolate min-h-[calc(100vh-180px)] overflow-hidden rounded-[36px]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-90 blur-[2px]">
          {variant === "double-monitor" ? <DoubleMonitorBackdrop /> : <OddsBackdrop />}
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,119,163,0.16),transparent_28%),linear-gradient(180deg,rgba(9,4,8,0.16),rgba(9,4,8,0.82))]" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-180px)] items-center justify-center px-6 py-12">
        <div className="max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
            LZ Labs
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white md:text-6xl">Em breve</h1>

          <p className="mt-4 text-xl font-medium text-[var(--text-secondary)] md:text-2xl">{title}</p>

          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--text-muted)] shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
            {message}
          </div>
        </div>
      </div>
    </section>
  );
}

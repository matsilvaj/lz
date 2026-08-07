import { Settings } from "lucide-react";

function MonitorBackdrop() {
  return (
    <div aria-hidden="true" className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/[0.06] px-5 py-4">
        <div className="h-10 w-40 rounded-xl bg-white/10" />
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-xl bg-white/10" />
          <div className="hidden h-10 w-20 rounded-xl bg-white/10 sm:block" />
        </div>
      </div>

      <div className="h-11 rounded-[24px] border border-white/10 bg-white/[0.06]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-4 rounded-[24px] border border-white/10 bg-white/[0.06] px-5 py-5 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(64px,0.3fr))]"
          key={index}
        >
          <div className="space-y-3">
            <div className="h-4 w-44 max-w-full rounded-full bg-white/12" />
            <div className="h-3 w-32 max-w-full rounded-full bg-white/8" />
          </div>

          {Array.from({ length: 3 }).map((__, itemIndex) => (
            <div
              className={`${itemIndex > 0 ? "hidden sm:block" : ""} space-y-2 text-center`}
              key={itemIndex}
            >
              <div className="mx-auto h-3 w-10 rounded-full bg-white/8" />
              <div className="mx-auto h-7 w-14 rounded-lg bg-white/12" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MonitorMaintenanceState() {
  return (
    <section
      aria-labelledby="monitor-maintenance-title"
      className="lz-panel relative isolate min-h-[calc(100vh-250px)] overflow-hidden rounded-[32px]"
    >
      <div className="absolute inset-0 overflow-hidden opacity-70 blur-[2px]">
        <MonitorBackdrop />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,119,163,0.18),transparent_32%),linear-gradient(180deg,rgba(9,4,8,0.32),rgba(9,4,8,0.9))]" />

      <div className="relative z-10 flex min-h-[calc(100vh-250px)] items-center justify-center px-6 py-14">
        <div className="max-w-2xl text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-[rgba(255,119,163,0.28)] bg-[rgba(216,31,89,0.14)] text-[var(--accent-soft)] shadow-[0_18px_50px_rgba(216,31,89,0.18)]">
            <Settings aria-hidden="true" size={30} strokeWidth={1.8} />
          </div>

          <span className="mt-6 inline-flex rounded-full border border-[rgba(255,190,115,0.22)] bg-[rgba(255,190,115,0.08)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--warning)]">
            Manutenção temporária
          </span>

          <h1
            className="mt-5 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl"
            id="monitor-maintenance-title"
          >
            Estamos atualizando o Monitor de Odds
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            O motor responsável pela leitura dos dados está recebendo melhorias. Para evitar a
            exibição de informações inconsistentes, esta área ficará temporariamente
            indisponível.
          </p>

          <p className="mt-7 text-sm font-medium text-[var(--text-muted)]">
            Voltaremos assim que a atualização for concluída.
          </p>
        </div>
      </div>
    </section>
  );
}

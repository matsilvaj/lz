import { logout } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const displayName =
    user.user_metadata?.full_name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Nao informado";

  return (
    <main className="flex min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-white/60">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Sessao autenticada com sucesso
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/70">
              Esta area ja esta protegida por autenticacao. A partir daqui, voce
              pode ligar as funcionalidades reais do seu SaaS com seguranca.
            </p>
          </div>

          <form action={logout}>
            <button className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-medium text-white transition hover:border-white/50">
              Sair
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <h2 className="text-sm font-medium text-white/80">Nome</h2>
            <p className="mt-3 text-lg font-semibold">{displayName}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <h2 className="text-sm font-medium text-white/80">Usuario</h2>
            <p className="mt-3 text-lg font-semibold">{user.email}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <h2 className="text-sm font-medium text-white/80">Auth provider</h2>
            <p className="mt-3 text-lg font-semibold">
              {user.app_metadata.provider ?? "email"}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <h2 className="text-sm font-medium text-white/80">Status</h2>
            <p className="mt-3 text-lg font-semibold">Autenticado</p>
          </article>
        </div>
      </section>
    </main>
  );
}

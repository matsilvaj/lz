import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-white px-6 py-6 text-neutral-950">
      <header className="flex justify-end gap-3">
        <Link
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-950"
          href="/login"
        >
          Login
        </Link>
        <Link
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          href="/cadastro"
        >
          Cadastro
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center">
        <h1 className="text-3xl font-semibold">Tela inicial</h1>
      </section>
    </main>
  );
}

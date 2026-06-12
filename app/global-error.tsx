"use client";

import { AppErrorState } from "@/app/_components/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text-primary)] md:px-6">
        <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center">
          <AppErrorState
            description="A aplicacao encontrou uma falha inesperada. Se foi uma oscilacao de banco ou servico externo, uma nova tentativa costuma resolver."
            error={error}
            reset={reset}
            title="Nao foi possivel carregar o site"
          />
        </main>
      </body>
    </html>
  );
}

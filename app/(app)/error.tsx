"use client";

import { AppErrorState } from "@/app/_components/error-state";

export default function AppAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      description="A area logada encontrou uma falha temporaria ao buscar ou preparar seus dados. Tente novamente em alguns instantes."
      error={error}
      reset={reset}
      title="Nao foi possivel abrir esta area"
    />
  );
}

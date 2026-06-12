"use client";

import { AppErrorState } from "@/app/_components/error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      description="Nao foi possivel carregar as metricas agora. Isso costuma acontecer quando o banco ou o pool de conexoes demora para responder."
      error={error}
      reset={reset}
      title="O dashboard nao carregou"
    />
  );
}

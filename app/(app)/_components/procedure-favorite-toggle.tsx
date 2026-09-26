"use client";

import { useOptimistic, useTransition } from "react";

import { useToast } from "@/app/_components/toast-provider";

import { toggleProcedureFavoriteAction } from "../procedure-actions";
import { FavoriteStarButton } from "./favorite-star-button";

// Estrela de favorito do procedimento (lista de procedimentos e histórico).
export function ProcedureFavoriteToggle({
  procedure,
}: {
  procedure: { favorito?: boolean; id: number };
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [favorite, setFavorite] = useOptimistic(Boolean(procedure.favorito));

  return (
    <FavoriteStarButton
      active={favorite}
      label="procedimento"
      onToggle={() => {
        const next = !favorite;

        startTransition(async () => {
          setFavorite(next);

          try {
            await toggleProcedureFavoriteAction(procedure.id, next);
          } catch {
            showToast({
              title: "Não foi possível atualizar o favorito.",
              tone: "error",
            });
          }
        });
      }}
      size="sm"
    />
  );
}

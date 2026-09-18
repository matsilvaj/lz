import { notFound } from "next/navigation";
import { after } from "next/server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getOddsEventByFixtureId } from "@/lib/monitor-odds/odds-data";
import { getProceduresRepository } from "@/lib/server";

import { OddsEventDetails } from "../../../odds/odds-event-search";

type MonitorOddsEventPageProps = {
  params: Promise<{
    fixtureId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function MonitorOddsEventPage({
  params,
}: MonitorOddsEventPageProps) {
  const { fixtureId } = await params;
  const [event, { user }] = await Promise.all([
    getOddsEventByFixtureId(fixtureId),
    requireWorkspaceContext(),
  ]);

  if (!event) {
    notFound();
  }

  // Conta o acesso para "Mais acessados" sem atrasar a página.
  after(async () => {
    try {
      await getProceduresRepository().recordMonitorEventView(
        user.id,
        event.fixture_id,
        event.starts_at,
      );
    } catch (error) {
      console.error("Falha ao registrar acesso ao jogo.", error);
    }
  });

  return <OddsEventDetails event={event} backHref="/monitor/odds" />;
}

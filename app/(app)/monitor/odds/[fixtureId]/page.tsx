import { notFound } from "next/navigation";

import { getOddsEventByFixtureId } from "@/lib/monitor-odds/odds-data";

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
  const event = await getOddsEventByFixtureId(fixtureId);

  if (!event) {
    notFound();
  }

  return <OddsEventDetails event={event} backHref="/monitor/odds" />;
}

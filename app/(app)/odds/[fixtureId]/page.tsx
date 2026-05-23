import { notFound } from "next/navigation";

import { getOddsEventByFixtureId } from "@/lib/monitor-odds/odds-data";

import { OddsEventDetails } from "../odds-event-search";

type OddsEventPageProps = {
  params: Promise<{
    fixtureId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OddsEventPage({ params }: OddsEventPageProps) {
  const { fixtureId } = await params;
  const event = await getOddsEventByFixtureId(fixtureId);

  if (!event) {
    notFound();
  }

  return <OddsEventDetails event={event} />;
}

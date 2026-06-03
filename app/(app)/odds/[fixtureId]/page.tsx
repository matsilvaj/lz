import { redirect } from "next/navigation";

type OddsEventPageProps = {
  params: Promise<{
    fixtureId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OddsEventPage({ params }: OddsEventPageProps) {
  const { fixtureId } = await params;
  redirect(`/monitor/odds/${encodeURIComponent(fixtureId)}`);
}

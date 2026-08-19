import { PlayerRoom } from "@/components/PlayerRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerRoom code={code} />;
}

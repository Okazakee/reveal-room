import { HostRoom } from "@/components/HostRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HostRoom code={code} />;
}

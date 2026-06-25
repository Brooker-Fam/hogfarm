import { notFound } from "next/navigation";
import { getFarmBySlug } from "@/lib/db";
import { getDashboardData, DashboardData } from "@/lib/posthog-analytics";
import { getReplayEmbedUrl } from "@/lib/posthog-replay";
import { verifyDashboardToken } from "@/lib/dashboard-auth";
import { DashboardView } from "@/components/DashboardView";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ debug?: string; k?: string }>;
}) {
  const slug = (await params).slug;
  const farm = await getFarmBySlug(slug);
  if (!farm) notFound();

  const sp = await searchParams;
  // notFound() (not 403) so the response doesn't confirm whether a slug exists.
  if (!verifyDashboardToken(slug, sp.k)) notFound();

  let data: DashboardData | null = null;
  let error = false;
  try {
    data = await getDashboardData(farm);
  } catch {
    error = true;
  }

  const replay = await getReplayEmbedUrl(farm);

  return <DashboardView farm={farm} data={data} error={error} replay={replay} debug={sp.debug === "1"} />;
}

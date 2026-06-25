import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFarmBySlug } from "@/lib/db";
import { PostHogScript } from "@/components/PostHogScript";
import { FarmSiteView } from "@/components/FarmSiteView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const farm = await getFarmBySlug((await params).slug);
  return farm ? { title: farm.name, description: farm.tagline } : { title: "Farm" };
}

export default async function FarmSite({ params }: { params: Promise<{ slug: string }> }) {
  const farm = await getFarmBySlug((await params).slug);
  if (!farm) notFound();

  return (
    <>
      <PostHogScript apiKey={farm.projectApiKey} region={farm.region} />
      <FarmSiteView farm={farm} />
    </>
  );
}

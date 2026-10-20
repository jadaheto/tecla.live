import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchExperience } from "@/features/youtube/components/watch-experience";

const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

export const metadata: Metadata = {
  title: "Reproductor",
  description: "Reproductor oficial de YouTube dentro de TECLA LIVE.",
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  if (!VIDEO_ID.test(videoId)) notFound();
  return <WatchExperience videoId={videoId} />;
}

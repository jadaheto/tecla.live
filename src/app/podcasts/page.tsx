import type { Metadata } from "next";
import { PodcastsPage } from "@/features/podcasts/components/podcasts-page";

export const metadata: Metadata = {
  title: "Podcasts",
  description: "Busca y escucha podcasts reales desde TECLA LIVE.",
};

export default function Page() {
  return <PodcastsPage />;
}

import type { Metadata } from "next";
import { TwitchPage } from "@/features/twitch/components/twitch-page";

export const metadata: Metadata = {
  title: "Twitch",
  description: "Reproductor oficial de Twitch dentro de TECLA LIVE.",
};

export default function Page() {
  return <TwitchPage />;
}

import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/components/settings-page";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Tema, pantalla, voz, privacidad y cuenta de TECLA LIVE.",
};

export default function Page() {
  return <SettingsPage />;
}

import type { Metadata } from "next";
import { AppsPage } from "@/features/apps/components/apps-page";

export const metadata: Metadata = {
  title: "Aplicaciones",
  description: "Todos los accesos de TECLA LIVE en un solo lugar.",
};

export default function Page() {
  return <AppsPage />;
}

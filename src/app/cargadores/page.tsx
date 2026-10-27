import type { Metadata } from "next";
import { ChargersPage } from "@/features/charging/components/chargers-page";

export const metadata: Metadata = {
  title: "Cargadores",
  description: "Estaciones de carga cercanas con el mapa de PlugShare, centradas en tu Tesla o en tu ubicación.",
};

export default function ChargersRoute() {
  return <ChargersPage />;
}

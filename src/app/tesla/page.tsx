import type { Metadata } from "next";
import { TeslaPage } from "@/features/tesla/components/tesla-page";

export const metadata: Metadata = {
  title: "Mi Tesla",
  description: "Batería, carga, clima, carrocería, llantas, ubicación, software, cargadores cercanos e historial de carga de tu Tesla.",
};

export default function TeslaRoute() {
  return <TeslaPage />;
}

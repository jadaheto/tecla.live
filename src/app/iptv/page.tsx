import type { Metadata } from "next";
import { IptvPage } from "@/features/iptv/components/iptv-page";

export const metadata: Metadata = {
  title: "IPTV",
  description: "Importa listas M3U autorizadas y reproduce canales en TECLA LIVE.",
};

export default function Page() {
  return <IptvPage />;
}

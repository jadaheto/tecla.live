import type { Metadata } from "next";
import { LibraryPage } from "@/features/library/components/library-page";

export const metadata: Metadata = {
  title: "Biblioteca",
  description: "Favoritos, historial, listas y destinos guardados en TECLA LIVE.",
};

export default function Page() {
  return <LibraryPage />;
}

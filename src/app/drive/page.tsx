import type { Metadata } from "next";
import { DriveExperience } from "@/features/drive/drive-experience";

export const metadata: Metadata = {
  title: "TECLA Drive — Paisajes y sonido",
  description: "Una experiencia original de TECLA LIVE: escenas animadas y sonido sintetizado para acompañar el camino.",
};

export default function DrivePage() {
  return <DriveExperience />;
}

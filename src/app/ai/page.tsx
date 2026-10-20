import type { Metadata } from "next";
import { AiWorkspace } from "@/features/ai/components/ai-workspace";

export const metadata: Metadata = {
  title: "TECLA AI",
  description: "Conversación por texto y voz con el copiloto de TECLA LIVE.",
};

export default function AiPage() {
  return <AiWorkspace />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RemotePage } from "@/features/remote/components/remote-page";
import { REMOTE_CODE } from "@/lib/remote/schema";

export const metadata: Metadata = {
  title: "Control remoto",
  description: "Controla TECLA LIVE en el auto desde tu celular.",
  robots: { index: false, follow: false },
};

export default async function RemoteRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!REMOTE_CODE.test(upper)) notFound();
  return <RemotePage code={upper} />;
}

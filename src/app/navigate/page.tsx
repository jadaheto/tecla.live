import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigatePage } from "@/features/navigation/components/navigate-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Navegación",
  description: "Prepara destinos y abre Waze o Google Maps desde TECLA LIVE.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-24 w-2/3" />
          <Skeleton className="h-12 w-52 rounded-full" />
          <Skeleton className="h-[360px] w-full rounded-[2rem]" />
        </div>
      }
    >
      <NavigatePage />
    </Suspense>
  );
}

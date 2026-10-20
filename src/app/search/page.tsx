import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchExperience } from "@/features/search/components/search-experience";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Búsqueda universal en TECLA LIVE.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      }
    >
      <SearchExperience />
    </Suspense>
  );
}

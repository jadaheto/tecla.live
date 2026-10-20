import type { Metadata } from "next";
import { Suspense } from "react";
import { RadioExperience } from "@/features/radio/components/radio-experience";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Radio",
  description: "Emisoras colombianas en vivo dentro de TECLA LIVE.",
};

export default function RadioPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-24 w-2/3" />
          <Skeleton className="h-24 w-full rounded-3xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-3xl" />
            ))}
          </div>
        </div>
      }
    >
      <RadioExperience />
    </Suspense>
  );
}

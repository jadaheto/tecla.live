import type { Metadata } from "next";
import { Suspense } from "react";
import { YouTubeHub } from "@/features/youtube/components/youtube-hub";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Videos",
  description: "Busca videos y tendencias de YouTube desde TECLA LIVE.",
};

export default function YouTubePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-28 w-full rounded-3xl" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="aspect-video w-full rounded-3xl" />
            ))}
          </div>
        </div>
      }
    >
      <YouTubeHub />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { MusicPage } from "@/features/music/components/music-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Música",
  description: "Spotify, radio y podcasts en TECLA LIVE.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-[460px] w-full rounded-[2rem]" />
        </div>
      }
    >
      <MusicPage />
    </Suspense>
  );
}

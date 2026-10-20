import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/layout/app-shell";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "TECLA LIVE — Entretenimiento inteligente para tu Tesla",
    template: "%s · TECLA LIVE",
  },
  description:
    "Centro de entretenimiento premium con YouTube, música, radio, podcasts, navegación y TECLA AI, tu copiloto de voz.",
  applicationName: "TECLA LIVE",
  keywords: ["Tesla", "entretenimiento", "YouTube", "radio", "podcasts", "asistente de voz"],
  openGraph: {
    title: "TECLA LIVE",
    description: "Tu centro de entretenimiento inteligente, dentro del Tesla.",
    url: appUrl,
    siteName: "TECLA LIVE",
    locale: "es_CO",
    type: "website",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050506" },
    { media: "(prefers-color-scheme: light)", color: "#f4f0e7" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
          suppressHydrationWarning
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}

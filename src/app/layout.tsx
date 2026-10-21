import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Orbitron, Rajdhani, Share_Tech_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/layout/app-shell";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const cyberFont = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cyber",
  display: "swap",
});

// «El auto fantástico»: Orbitron para títulos y Share Tech Mono para lecturas digitales.
const kittFont = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-kitt",
  display: "swap",
});
const kittMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-kitt-mono",
  display: "swap",
});

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
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${cyberFont.variable} ${kittFont.variable} ${kittMono.variable} font-sans antialiased`}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}

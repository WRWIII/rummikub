import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerManager } from "@/components/service-worker-manager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rummikub Turn Timer",
  description:
    "Tap anywhere to reset the turn. Three rising tones at 3, 2, 1, then the alarm at zero.",
  applicationName: "Turn Timer",
  appleWebApp: {
    capable: true,
    title: "Turn Timer",
    statusBarStyle: "black-translucent",
  },
};

/**
 * `viewport` is its own export in Next 16, not a field on `metadata`, and both
 * are Server-Component-only — which is why every page here is a server shell
 * around a client screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // The whole screen is a tap target; double-tap-zoom is a bug here.
  userScalable: false,
  // Required for edge-to-edge under a translucent status bar.
  viewportFit: "cover",
  themeColor: "#0e3b2e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerManager />
      </body>
    </html>
  );
}

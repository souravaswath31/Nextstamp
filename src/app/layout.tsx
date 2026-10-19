import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Chrome from "@/components/Chrome";
import { SITE_URL } from "@/lib/siteUrl";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const viewport: Viewport = { themeColor: "#0B0D12", colorScheme: "dark" };

const description = "The trip idea, worked out before you book it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NextStamp",
  description,
  openGraph: {
    title: "NextStamp",
    description,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "NextStamp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NextStamp",
    description,
    images: ["/og-image.jpg"],
  },
};

// No cookie or database read here on purpose: it keeps every public page cacheable. The navigation learns
// whether you are signed in on the client (see useHasSession); pages that show personal data check the
// real session themselves.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${plexMono.variable} font-body flex min-h-screen flex-col`}
      >
        <Chrome>{children}</Chrome>
        <Analytics />
      </body>
    </html>
  );
}

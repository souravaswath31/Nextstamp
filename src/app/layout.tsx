import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

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

const description = "The trip idea, worked out before you book it.";

export const metadata: Metadata = {
  metadataBase: new URL("https://nextstamp-app.vercel.app"),
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${plexMono.variable} font-body`}
      >
        <NavBar />
        <main className="mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8 sm:pt-10">
          {children}
        </main>
      </body>
    </html>
  );
}

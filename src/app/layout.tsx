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

export const metadata: Metadata = {
  title: "NextStamp",
  description: "The trip idea, worked out before you book it.",
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

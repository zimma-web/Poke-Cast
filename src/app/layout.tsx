import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { LayoutWrapper } from "@/components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "PokéCast",
  description: "The ultimate Farcaster Pokémon TCG Mini App. Rip packs, collect cards, and trade on Base Chain!",
  openGraph: {
    title: "PokéCast",
    description: "The ultimate Farcaster Pokémon TCG Mini App. Rip packs, collect cards, and trade on Base Chain!",
    url: "https://poke-cast.vercel.app",
    siteName: "PokéCast",
    images: [
      {
        url: "https://poke-cast.vercel.app/PokeCast.png",
        width: 1200,
        height: 800,
        alt: "PokéCast",
      },
    ],
    type: "website",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://poke-cast.vercel.app/PokeCast.png",
      button: {
        title: "Open PokéCast",
        action: {
          type: "launch_frame",
          name: "PokéCast",
          url: "https://poke-cast.vercel.app",
          splashImageUrl: "https://poke-cast.vercel.app/PokeCast.png",
          splashBackgroundColor: "#09090b",
        },
      },
    }),
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased selection:bg-primary/20 overscroll-none`}>
        <Providers>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}

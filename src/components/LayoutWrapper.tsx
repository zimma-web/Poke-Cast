"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') || false;

  if (isAdmin) {
    // Desktop & fully responsive layout for admin panel without bottom nav or 390px max-width container
    return (
      <div className="min-h-screen bg-zinc-950 w-full overflow-y-auto">
        {children}
      </div>
    );
  }

  // Mobile layout for Farcaster miniapp cards and selectors
  return (
    <div className="flex flex-col min-h-[100dvh] max-w-[390px] mx-auto bg-card/30 relative overflow-hidden shadow-2xl">
      <main className="flex-1 overflow-y-auto pb-20 no-scrollbar">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PackageOpen, Layers, User, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useCollectionStore } from "@/lib/store";

export function BottomNav() {
  const pathname = usePathname();
  const userId = useCollectionStore(state => state.userId);
  const [pendingOffers, setPendingOffers] = useState(0);

  // Poll for pending offers on user's listings every 30 seconds
  useEffect(() => {
    if (!userId) return;
    const fetchBadge = async () => {
      try {
        const res = await fetch(`/api/marketplace?userId=${userId}`);
        const data = await res.json();
        setPendingOffers(data.pendingOffers || 0);
      } catch { /* ignore */ }
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/pack", label: "Pack", icon: PackageOpen },
    { href: "/collection", label: "Cards", icon: Layers },
    { href: "/marketplace", label: "Market", icon: Store, badge: pendingOffers },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="max-w-[390px] mx-auto flex items-center justify-around h-16 px-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 text-muted-foreground transition-colors active:scale-95 relative",
                isActive && "text-primary"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
                {link.badge != null && link.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-fuchsia-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-lg shadow-fuchsia-500/30">
                    {link.badge > 9 ? "9+" : link.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

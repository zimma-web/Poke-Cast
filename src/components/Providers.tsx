"use client";

import { useEffect, useState, useRef } from "react";
import sdk from "@farcaster/frame-sdk";
import { useCollectionStore } from "@/lib/store";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') || false;

  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState<boolean | null>(null);
  const { setAuth, setCollection, setLoading, loading } = useCollectionStore();
  const initializedRef = useRef(false);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const load = async () => {
      // Initialize the Farcaster Mini App SDK
      try {
        if (sdk && typeof sdk.actions.ready === 'function') {
          sdk.actions.ready();
        }
      } catch (e) {
        console.error("Frame SDK ready error:", e);
      }
      setIsSDKLoaded(true);

      // Authenticate Farcaster user context
      try {
        let context = null;
        try {
          if (sdk) {
            // Wrap sdk.context in Promise.race to prevent hanging in regular browsers
            context = await Promise.race([
              sdk.context,
              new Promise((_, reject) => setTimeout(() => reject(new Error("SDK context timeout")), 1000))
            ]) as any;
          }
        } catch (e) {
          console.warn("Frame SDK context load failed:", e);
        }

        if (!context || !context.user) {
          setIsFarcaster(false);
          setLoading(false);
          return;
        }

        setIsFarcaster(true);
        const userFid = context.user.fid;
        const userUsername = context.user.username || "trainer_" + userFid;
        const userAvatar = context.user.pfpUrl || "";

        // 1. Post to auth endpoint
        const authRes = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid, username: userUsername, avatar: userAvatar })
        });
        const authData = await authRes.json();
        
        if (authData.id) {
          setAuth({
            userId: authData.id,
            fid: authData.fid,
            username: authData.username,
            avatar: authData.avatar,
            packTickets: authData.pack_tickets,
            freePacksRemaining: authData.free_packs_remaining,
            lastDailyReset: authData.last_daily_reset
          });

          // 2. Sync legacy local collection once if it exists
          const localDataStr = localStorage.getItem('tcg-collection-storage');
          const isMigrated = localStorage.getItem('tcg_collection_migrated');
          
          if (localDataStr && !isMigrated) {
            try {
              const localData = JSON.parse(localDataStr);
              const ownedCards = localData?.state?.ownedCards || {};
              
              if (Object.keys(ownedCards).length > 0) {
                // Trigger batch insert migration
                await fetch('/api/collection/migrate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: authData.id, ownedCards })
                });
              }
            } catch (err) {
              console.error("Failed to parse local storage for migration:", err);
            }
            localStorage.setItem('tcg_collection_migrated', 'true');
          }

          // 3. Fetch synced card database and user stats from Supabase
          const collectionRes = await fetch(`/api/collection?userId=${authData.id}`);
          const collectionData = await collectionRes.json();

          setCollection({
            ownedCards: collectionData.ownedCards || {},
            uniqueCards: collectionData.uniqueCards || 0,
            collectionScore: collectionData.collectionScore || 0,
            packsOpened: collectionData.packsOpened || 0,
            packTickets: collectionData.packTickets,
            freePacksRemaining: collectionData.freePacksRemaining,
            lastDailyReset: collectionData.lastDailyReset
          });
        }
      } catch (e) {
        console.error("Failed to sync authenticated user collection:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Prevent UI rendering before SDK ready and user authentication completes
  if (!isSDKLoaded || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-fuchsia-500 border-r-2 border-r-transparent" />
        <p className="mt-4 text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Loading Collection...</p>
      </div>
    );
  }

  // Display a lock screen for regular browsers outside Farcaster
  if (isFarcaster === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-zinc-950 text-white p-6 text-center">
        <div className="text-5xl mb-4">🎴</div>
        <h1 className="text-xl font-bold mb-2">Farcaster Only</h1>
        <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
          This app can only be opened and played inside Farcaster client apps (like Warpcast).
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

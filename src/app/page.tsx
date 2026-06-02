"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectionStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [stats, setStats] = useState({ cards: 0, sets: 0, loading: true });

  const {
    userId,
    loginStreak,
    highestStreak,
    claimedToday,
    updateStreak,
    updateEconomy
  } = useCollectionStore();

  const [claiming, setClaiming] = useState(false);
  const [claimRewardDetails, setClaimRewardDetails] = useState<{
    rewardType: string;
    rewardAmount: number;
  } | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [cardsRes, setsRes] = await Promise.all([
          fetch('/api/cards?limit=1'),
          fetch('/api/sets')
        ]);
        const cardsData = await cardsRes.json();
        const setsData = await setsRes.json();
        setStats({ cards: cardsData.total || 0, sets: setsData.total || 0, loading: false });
      } catch (e) {
        console.error("Failed to fetch stats", e);
        setStats({ cards: 20000, sets: 170, loading: false }); // Fallback
      }
    }
    fetchStats();
  }, []);

  const handleClaim = async () => {
    if (!userId || claiming || claimedToday) return;

    setClaiming(true);
    try {
      const res = await fetch('/api/login-streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      
      if (res.status === 200 && data.success) {
        // Update client store state
        updateStreak({
          loginStreak: displayStreakDay,
          highestStreak: Math.max(highestStreak, displayStreakDay),
          claimedToday: true
        });

        // Sync tickets/packs in store
        updateEconomy({
          packTickets: data.packTickets,
          freePacksRemaining: data.freePacksRemaining,
          lastDailyReset: new Date().toISOString()
        });

        // Trigger claims popup details
        setClaimRewardDetails({
          rewardType: data.rewardType,
          rewardAmount: data.rewardAmount
        });
      } else {
        console.error("Failed to claim reward:", data.error);
      }
    } catch (e) {
      console.error("Claim error:", e);
    } finally {
      setClaiming(false);
    }
  };

  const displayStreakDay = loginStreak || 1;
  const isMultipleOf7 = displayStreakDay % 7 === 0;
  const rewardText = isMultipleOf7 
    ? "+10 Pack Tickets & +1 Bonus Pack" 
    : `+${displayStreakDay % 7} Pack Ticket${(displayStreakDay % 7) > 1 ? 's' : ''}`;

  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">PokéCast</h1>
        <p className="text-muted-foreground text-sm">Your ultimate card collection journey.</p>
      </div>

      {/* Daily Login Streak Banner */}
      <div className="bg-zinc-900/40 rounded-2xl p-4 border border-zinc-800/80 flex items-center justify-between backdrop-blur-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/5 to-violet-500/5 pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🔥</span>
            <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">
              Day {displayStreakDay} Login Reward
            </span>
          </div>
          <p className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-300">
            {rewardText}
          </p>
        </div>
        <div>
          {claimedToday ? (
            <button 
              disabled 
              className="bg-zinc-800/60 border border-zinc-700/50 text-zinc-500 text-xs font-bold font-mono px-4 py-2.5 rounded-full flex items-center space-x-1"
            >
              <span>Claimed</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          ) : (
            <Button 
              size="sm" 
              onClick={handleClaim} 
              disabled={claiming || !userId}
              className="bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.2)] transform hover:scale-105 transition-all duration-300"
            >
              {claiming ? "Claiming..." : "Claim Reward"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-none shadow-none rounded-2xl">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
            <Layers className="w-8 h-8 text-primary" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Sets</p>
              {stats.loading ? <Skeleton className="h-6 w-12 mx-auto mt-1" /> : <p className="text-2xl font-bold">{stats.sets}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-none shadow-none rounded-2xl">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
            <Sparkles className="w-8 h-8 text-blue-500" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Cards</p>
              {stats.loading ? <Skeleton className="h-6 w-16 mx-auto mt-1" /> : <p className="text-2xl font-bold">{(stats.cards / 1000).toFixed(1)}k</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center mt-8">
        <div className="relative w-full max-w-[280px] aspect-[2.5/3.5] bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-3xl shadow-2xl flex items-center justify-center p-1 group transform transition-transform hover:scale-105">
          <div className="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse" />
          <div className="relative w-full h-full bg-background/90 backdrop-blur-sm rounded-[22px] flex flex-col items-center justify-center border border-white/20 space-y-4">
            <span className="text-5xl">🎁</span>
            <div className="text-center">
              <p className="font-bold text-lg">Daily Pack</p>
              <p className="text-xs text-muted-foreground">Ready to open!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-2">
        <Link href="/pack" className="w-full">
          <Button size="lg" className="w-full h-14 rounded-full text-lg font-bold shadow-xl shadow-primary/25">
            Open Pack
          </Button>
        </Link>
      </div>

      {/* Daily Login Reward Claims Popup */}
      <AnimatePresence>
        {claimRewardDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md"
            onClick={() => setClaimRewardDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-zinc-900/90 border border-fuchsia-500/30 rounded-3xl p-6 text-center max-w-sm w-full relative overflow-hidden shadow-[0_0_50px_rgba(217,70,239,0.15)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated background highlights */}
              <div className="absolute inset-0 bg-radial-gradient from-fuchsia-500/10 to-transparent pointer-events-none" />
              
              <div className="flex flex-col items-center space-y-4">
                {/* Fire Animation / Icon */}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 flex items-center justify-center text-3xl border border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.3)]"
                >
                  🔥
                </motion.div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white">Daily Streak Reward</h3>
                  <p className="text-xs text-zinc-500 font-mono">Streak Day {displayStreakDay}</p>
                </div>

                <div className="py-4 px-6 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 w-full flex flex-col items-center justify-center space-y-2">
                  <span className="text-sm font-semibold text-zinc-400">You Received:</span>
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      🎟️ +{claimRewardDetails.rewardAmount} Pack Ticket{claimRewardDetails.rewardAmount > 1 ? 's' : ''}
                    </span>
                    {claimRewardDetails.rewardType === 'tickets_and_pack' && (
                      <span className="text-lg font-black text-fuchsia-400 font-mono mt-1">
                        📦 +1 Bonus Pack
                      </span>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => setClaimRewardDetails(null)}
                  className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white font-bold h-12 rounded-full mt-2"
                >
                  Awesome!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

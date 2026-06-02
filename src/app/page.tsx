"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles, Layers, Wallet, Award, Trophy,
  Clock, ArrowRight, Coins, Gift, Flame, Info, Check,
  ChevronRight, Calendar, ArrowRightLeft, ShieldAlert,
  TrendingUp, CheckCircle2, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectionStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import sdk from "@farcaster/frame-sdk";

export default function Home() {
  const [stats, setStats] = useState({ cards: 0, sets: 0, loading: true });
  const [rarestPulls, setRarestPulls] = useState<any[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<any[]>([]);
  const [loadingUserStats, setLoadingUserStats] = useState(true);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  // Daily Quests states
  const [quests, setQuests] = useState<any[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(true);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);

  const {
    userId,
    username,
    avatar,
    ownedCards = {},
    uniqueCards = 0,
    packTickets = 0,
    freePacksRemaining = 0,
    walletAddress = null,
    usdcBalance = 0,
    loginStreak,
    highestStreak,
    claimedToday,
    updateStreak,
    updateEconomy,
    achievements = []
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

  const fetchQuests = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/quests?userId=${userId}`);
      const data = await res.json();
      if (data.quests) {
        setQuests(data.quests);
      }
    } catch (e) {
      console.error("Failed to fetch quests:", e);
    } finally {
      setLoadingQuests(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    async function fetchUserCollectionAndAuctions() {
      setLoadingUserStats(true);
      try {
        // Fetch user collection which includes rarestPulls
        const colRes = await fetch(`/api/collection?userId=${userId}`);
        const colData = await colRes.json();
        if (colData.rarestPulls) {
          setRarestPulls(colData.rarestPulls);
        }

        // Fetch marketplace active auctions
        const mrktRes = await fetch("/api/marketplace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_feed",
            payload: { page: 1, limit: 3, userId }
          })
        });
        const mrktData = await mrktRes.json();
        if (mrktData.auctions) {
          setActiveAuctions(mrktData.auctions);
        }
      } catch (e) {
        console.error("Failed to fetch user collection or auctions feed", e);
      } finally {
        setLoadingUserStats(false);
      }
    }
    fetchUserCollectionAndAuctions();
  }, [userId]);

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

        // Refresh quests to show daily check-in quest completed
        fetchQuests();
      } else {
        console.error("Failed to claim reward:", data.error);
      }
    } catch (e) {
      console.error("Claim error:", e);
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    if (!userId || claimingQuestId) return;
    setClaimingQuestId(questId);
    try {
      const res = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questId })
      });
      const data = await res.json();
      if (data.success) {
        // Update local quest state to claimed
        setQuests(prev => prev.map(q => q.quest_id === questId ? { ...q, claimed: true } : q));
        
        // Sync tickets in store
        updateEconomy({
          packTickets: data.packTickets,
          freePacksRemaining: freePacksRemaining,
          lastDailyReset: new Date().toISOString()
        });

        // Trigger native success haptic feedback
        sdk.haptics.notificationOccurred('success').catch(() => {});
      } else {
        console.error("Failed to claim quest:", data.error);
      }
    } catch (e) {
      console.error("Claim quest error:", e);
    } finally {
      setClaimingQuestId(null);
    }
  };

  const displayStreakDay = loginStreak || 1;
  const isMultipleOf7 = displayStreakDay % 7 === 0;
  const rewardText = isMultipleOf7 
    ? "+10 Pack Tickets & +1 Bonus Pack" 
    : `+${displayStreakDay % 7} Pack Ticket${(displayStreakDay % 7) > 1 ? 's' : ''}`;

  const totalCopies = Object.values(ownedCards).reduce((acc, val) => acc + val, 0);
  const duplicatesCount = Object.values(ownedCards).reduce((acc, val) => acc + (val > 1 ? val - 1 : 0), 0);
  const completionPercent = stats.cards > 0 ? (uniqueCards / stats.cards) * 100 : 0;
  
  const completedAchievements = achievements.filter(a => a.unlocked).length;

  const shareCardToFarcaster = (card: any) => {
    const text = `🔥 I just pulled ${card.name} (${card.rarity || 'Rare'}) in PokéCast! Look at my rarest collection milestone. Ripping packs and trading with real USDC on Base. #PokeCast`;
    const embedUrl = card.largeImage || card.smallImage || "";
    
    sdk.actions.composeCast({
      text,
      embeds: [embedUrl]
    }).catch(() => {
      // Fallback web url compose sheet
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;
      window.open(url, "_blank");
    });
  };

  return (
    <div className="flex flex-col min-h-screen px-4 pt-6 pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sleek Header & Welcome Panel */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <img src="/Text-PokeCast.png" alt="PokéCast" className="h-6 object-contain" />
            <div className="px-2 py-0.5 bg-fuchsia-500/10 text-fuchsia-400 text-[8px] font-bold rounded-full border border-fuchsia-500/25 uppercase tracking-widest">
              Live
            </div>
          </div>
          <p className="text-xs text-zinc-400 font-medium">Welcome back, Trainer <span className="text-zinc-200 font-bold">{username || "Guest"}</span>!</p>
        </div>
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-800 shadow-md">
          {avatar ? (
            <img src={avatar} alt={username || "User"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
              P
            </div>
          )}
        </div>
      </div>

      {/* Daily Login Streak Banner */}
      <div className="bg-zinc-900/40 rounded-2xl p-4 border border-zinc-800/80 flex items-center justify-between backdrop-blur-md relative overflow-hidden group shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/5 to-violet-500/5 pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-base">🔥</span>
            <span className="text-[10px] font-mono font-black text-fuchsia-400 uppercase tracking-wider">
              Streak Day {displayStreakDay} Check-In
            </span>
          </div>
          <p className="text-xs font-bold text-zinc-100">
            {rewardText}
          </p>
        </div>
        <div>
          {claimedToday ? (
            <button 
              disabled 
              className="bg-zinc-800/40 border border-zinc-700/30 text-zinc-500 text-[10px] font-bold font-mono px-3.5 py-1.5 rounded-full flex items-center space-x-1"
            >
              <span>Claimed</span>
              <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
            </button>
          ) : (
            <Button 
              size="sm" 
              onClick={handleClaim} 
              disabled={claiming || !userId}
              className="bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white text-[10px] font-bold font-mono px-3.5 py-1.5 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.2)] transform hover:scale-105 transition-all duration-300"
            >
              {claiming ? "Claiming..." : "Claim"}
            </Button>
          )}
        </div>
      </div>

      {/* Trainer Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Wallet & USDC State */}
        <Link href="/marketplace" className="col-span-1">
          <Card className="bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/50 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
            <CardContent className="p-3.5 flex flex-col justify-between h-24 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">USDC Wallet</span>
                <Wallet className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-lg font-black text-zinc-100 font-mono tracking-tight">{usdcBalance.toFixed(2)}</p>
                <p className="text-[8px] text-zinc-500 font-mono truncate">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "No Address"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Resources / Economy State */}
        <Link href="/pack" className="col-span-1">
          <Card className="bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/50 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 via-transparent to-transparent pointer-events-none" />
            <CardContent className="p-3.5 flex flex-col justify-between h-24 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Packs Available</span>
                <Gift className="w-4 h-4 text-fuchsia-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-lg font-black text-zinc-100 font-mono tracking-tight">{freePacksRemaining} <span className="text-[10px] text-zinc-500 font-normal">Daily</span></p>
                <p className="text-[8px] text-zinc-400 font-semibold font-mono flex items-center space-x-1">
                  <span>Tickets:</span>
                  <span className="text-amber-400 font-black">🎟️ {packTickets}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Collection Stats Ring Panel */}
      <Link href="/collection">
        <Card className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/50 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-transparent pointer-events-none" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Radial Progress Ring */}
              <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="24" className="text-zinc-800" strokeWidth="4.5" fill="transparent" />
                  <circle cx="28" cy="28" r="24" className="text-fuchsia-500 transition-all duration-1000 ease-out" strokeWidth="4.5" fill="transparent" strokeDasharray={150.79} strokeDashoffset={150.79 - (150.79 * completionPercent) / 100} strokeLinecap="round" />
                </svg>
                <span className="absolute text-[10px] font-black text-zinc-200 font-mono">
                  {completionPercent.toFixed(0)}%
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Collection Journey</span>
                <p className="text-sm font-bold text-zinc-200">
                  {uniqueCards} <span className="text-xs text-zinc-500 font-normal">/ {stats.loading ? "..." : stats.cards} Uniques</span>
                </p>
                <div className="flex items-center space-x-3 text-[9px] text-zinc-500 font-mono">
                  <span>Copies: {totalCopies}</span>
                  <span>•</span>
                  <span>Dupes: {duplicatesCount}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform" />
          </CardContent>
        </Card>
      </Link>

      {/* Quest Board Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-fuchsia-500 shrink-0" />
          <h3 className="text-sm font-black text-zinc-100 uppercase tracking-tight">Daily Quests</h3>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-4 space-y-3.5 backdrop-blur-sm">
          {loadingQuests ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5 w-2/3">
                  <Skeleton className="h-3.5 w-1/3 bg-zinc-800" />
                  <Skeleton className="h-2.5 w-2/3 bg-zinc-800" />
                </div>
                <Skeleton className="h-7 w-16 rounded-full bg-zinc-800" />
              </div>
            ))
          ) : quests.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center font-medium">No quests initialized today.</p>
          ) : (
            quests.map((quest) => {
              const isCompleted = quest.progress >= quest.target;
              const isClaimed = quest.claimed;
              
              return (
                <div key={quest.id} className="flex items-center justify-between space-x-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      {isClaimed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-700 shrink-0" />
                      )}
                      <h4 className={`text-xs font-bold truncate ${isClaimed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {quest.title}
                      </h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate pl-6">{quest.desc}</p>
                    
                    {/* Progress Bar */}
                    <div className="pl-6 pt-1 flex items-center space-x-2">
                      <div className="h-1.5 flex-1 max-w-[120px] bg-zinc-800/60 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${isClaimed ? 'bg-zinc-700' : isCompleted ? 'bg-emerald-500' : 'bg-fuchsia-500'}`}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500 font-bold shrink-0">
                        {quest.progress} / {quest.target}
                      </span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 text-right">
                    {isClaimed ? (
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">Claimed 🎟️</span>
                    ) : isCompleted ? (
                      <Button
                        size="sm"
                        onClick={() => handleClaimQuest(quest.quest_id)}
                        disabled={claimingQuestId !== null}
                        className="bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white font-mono font-bold text-[10px] h-7 px-3.5 rounded-full shadow-[0_0_10px_rgba(217,70,239,0.15)] transform active:scale-95 transition-transform"
                      >
                        Claim 🎟️+{quest.reward}
                      </Button>
                    ) : (
                      <span className="text-[9px] font-mono font-bold text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-full shrink-0">
                        🎟️ +{quest.reward}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Rarest Pulls horizontal showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-tight">Rarest Pulls</h3>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 font-mono">Tap for Details</span>
        </div>

        {loadingUserStats ? (
          <div className="flex space-x-3 overflow-hidden py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-28 aspect-[2.5/3.5] rounded-xl shrink-0 bg-zinc-900" />
            ))}
          </div>
        ) : rarestPulls.length === 0 ? (
          <div className="bg-zinc-950/40 rounded-2xl p-6 text-center border border-zinc-900 flex flex-col items-center justify-center space-y-2">
            <span className="text-2xl">✨</span>
            <h4 className="text-xs font-bold text-zinc-300">No Rare Card Pulls Yet</h4>
            <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">
              Open booster packs inside the Pack tab to find rare cards and display them here!
            </p>
            <Link href="/pack">
              <Button size="sm" className="bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20 text-[10px] h-8 rounded-full px-4 mt-1 font-bold">
                Get Booster Packs
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex space-x-3 overflow-x-auto scrollbar-hide py-1 px-0.5">
            {rarestPulls.map((card) => (
              <motion.div
                key={card.id}
                whileHover={{ scale: 1.04, y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedCard(card)}
                className="relative flex-shrink-0 w-28 aspect-[2.5/3.5] rounded-xl overflow-hidden cursor-pointer border border-zinc-800/80 bg-zinc-900/60 group shadow-md"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out z-20 pointer-events-none" />
                
                {card.smallImage ? (
                  <Image
                    src={card.smallImage}
                    alt={card.name}
                    fill
                    sizes="112px"
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 p-2 text-center font-mono">
                    {card.name}
                  </div>
                )}
                
                <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20">
                  <p className="text-[9px] font-black text-white truncate leading-tight">
                    {card.name}
                  </p>
                  <p className="text-[7px] text-fuchsia-400 font-extrabold truncate uppercase tracking-wider leading-none mt-0.5">
                    {card.rarity || 'Rare'}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* USDC Auction House snapshot */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-tight">USDC Auction House</h3>
          </div>
          <Link href="/marketplace" className="text-[9px] text-zinc-400 hover:text-fuchsia-400 flex items-center space-x-0.5 font-bold transition-colors">
            <span>View All</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {loadingUserStats ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-zinc-900" />
            ))
          ) : activeAuctions.length === 0 ? (
            <div className="bg-zinc-950/40 rounded-2xl p-5 text-center border border-zinc-900 flex flex-col items-center justify-center space-y-1.5">
              <span className="text-xl">🪙</span>
              <h4 className="text-xs font-bold text-zinc-300">Auction House is Quiet</h4>
              <p className="text-[10px] text-zinc-500 max-w-[220px]">
                No active auctions currently listed. Be the first to start an auction!
              </p>
              <Link href="/marketplace">
                <Button size="sm" className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] h-8 rounded-full px-4 mt-0.5 font-bold">
                  List a Card
                </Button>
              </Link>
            </div>
          ) : (
            activeAuctions.map((auction) => {
              return (
                <AuctionItemRow key={auction.id} auction={auction} />
              );
            })
          )}
        </div>
      </div>

      {/* Achievement Progress Summary */}
      <Link href="/profile">
        <Card className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/50 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent pointer-events-none" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3.5 w-full mr-2">
              <Award className="w-8 h-8 text-amber-400 shrink-0" />
              <div className="space-y-1 w-full">
                <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                  <span>Achievements Milestone</span>
                  <span className="font-mono text-zinc-200">{completedAchievements} / 9</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(completedAchievements / 9) * 100}%` }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                  />
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform" />
          </CardContent>
        </Card>
      </Link>

      {/* Card detail inspection overlay */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md"
            onClick={() => setSelectedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 18 }}
              className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 text-center max-w-sm w-full relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <span className="text-lg">✕</span>
              </button>
              
              <div className="flex flex-col items-center space-y-4 pt-2">
                <div className="relative w-44 aspect-[2.5/3.5] bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl">
                  {selectedCard.largeImage || selectedCard.smallImage ? (
                    <Image
                      src={selectedCard.largeImage || selectedCard.smallImage}
                      alt={selectedCard.name}
                      fill
                      sizes="176px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm font-mono">{selectedCard.name}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">{selectedCard.name}</h3>
                  <div className="flex items-center justify-center space-x-2 text-[10px] text-zinc-400 font-mono uppercase">
                    <span>{selectedCard.setId}</span>
                    <span>•</span>
                    <span className="text-fuchsia-400 font-bold">{selectedCard.rarity || 'Rare'}</span>
                  </div>
                </div>

                <div className="py-2.5 px-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 w-full grid grid-cols-2 gap-2 text-left text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Card ID</span>
                    <span className="text-zinc-300 truncate block">{selectedCard.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Rarity Score</span>
                    <span className="text-amber-400 font-bold block">★ {selectedCard.rarity === 'Illustration Rare' ? 75 : selectedCard.rarity === 'Rare Secret' ? 50 : selectedCard.rarity === 'Rare Ultra' ? 25 : selectedCard.rarity === 'Rare Holo' ? 10 : 5} pts</span>
                  </div>
                </div>

                <div className="flex space-x-2 w-full mt-2">
                  <Button
                    onClick={() => shareCardToFarcaster(selectedCard)}
                    className="flex-1 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white font-bold h-11 rounded-full text-xs"
                  >
                    Share to Farcaster 💜
                  </Button>
                  <Button
                    onClick={() => setSelectedCard(null)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold h-11 rounded-full px-5 text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="absolute inset-0 bg-radial-gradient from-fuchsia-500/10 to-transparent pointer-events-none" />
              
              <div className="flex flex-col items-center space-y-4">
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

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function AuctionItemRow({ auction }: { auction: any }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(auction.end_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.end_at]);

  return (
    <Link href={`/marketplace?auctionId=${auction.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm cursor-pointer hover:border-zinc-700/50 transition-all duration-300"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative w-10 h-14 bg-zinc-800 rounded-md overflow-hidden shrink-0 border border-zinc-800">
            {auction.card.smallImage ? (
              <Image 
                src={auction.card.smallImage} 
                alt={auction.card.name} 
                fill 
                sizes="40px"
                className="object-contain p-0.5" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[7px] text-zinc-500 font-mono text-center leading-none">
                {auction.card.name}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">{auction.card.name}</h4>
            <p className="text-[9px] text-fuchsia-400 font-extrabold truncate uppercase tracking-wider">{auction.card.rarity || 'Rare'}</p>
            <div className="flex items-center space-x-1.5 mt-1 text-[9px] text-zinc-500 font-mono">
              <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="text-amber-500 font-bold shrink-0">{timeLeft}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-mono">
            {(auction.highest_bid > 0 ? auction.highest_bid : auction.start_price).toFixed(2)} USDC
          </div>
          <p className="text-[8px] text-zinc-500 font-medium uppercase tracking-wider">
            {auction.highest_bid > 0 ? "Highest Bid" : "Start Price"}
          </p>
          {auction.buyout_price && (
            <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
              Buyout: {auction.buyout_price.toFixed(0)} USDC
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

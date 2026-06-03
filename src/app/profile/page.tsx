"use client";

import { useEffect, useState } from "react";
import { User, Trophy, PackageOpen, Layers, Sparkles, History, Award, List, Ticket } from "lucide-react";
import sdk from "@farcaster/frame-sdk";
import { useCollectionStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function ProfileScreen() {
  const { 
    userId,
    username, 
    avatar, 
    fid, 
    ownedCards, 
    uniqueCards, 
    collectionScore, 
    packsOpened,
    wishlist = {},
    achievements = [],
    setAchievements,
    loginStreak = 0,
    highestStreak = 0,
    pokepoints: storePoints,
    lifetimePoints: storeLifetime,
    referralCode,
    totalReferrals = 0,
    successfulReferrals = 0,
    referralTicketsEarned = 0,
    updatePokePoints
  } = useCollectionStore();

  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [pointsData, setPointsData] = useState<{
    pokepoints: number;
    lifetimePoints: number;
    rank: { name: string; minPoints: number; maxPoints: number | null; color: string; emoji: string };
    nextRank: { name: string; minPoints: number; maxPoints: number | null; color: string; emoji: string } | null;
    rankProgress: number;
    history: any[];
  } | null>(null);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"achievements" | "leaderboard" | "history">("achievements");

  useEffect(() => {
    if (!userId) return;
    
    const fetchAchievements = async () => {
      setLoadingAchievements(true);
      try {
        const res = await fetch(`/api/achievements?userId=${userId}`);
        const data = await res.json();
        if (data.achievements) {
          setAchievements(data.achievements);
        }
      } catch (err) {
        console.error("Failed to fetch achievements on profile mount:", err);
      } finally {
        setLoadingAchievements(false);
      }
    };

    const fetchPoints = async () => {
      try {
        const res = await fetch(`/api/pokepoints?userId=${userId}`);
        const data = await res.json();
        if (data && !data.error) {
          setPointsData(data);
          updatePokePoints({
            pokepoints: data.pokepoints,
            lifetimePoints: data.lifetimePoints
          });
        }
      } catch (err) {
        console.error("Failed to fetch pokepoints:", err);
      }
    };

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/pokepoints?leaderboard=true`);
        const data = await res.json();
        if (data && data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };

    fetchAchievements();
    fetchPoints();
    fetchLeaderboard();
  }, [userId, setAchievements, updatePokePoints]);

  const totalCards = Object.values(ownedCards).reduce((a, b) => a + b, 0);
  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : "Trainer";

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length || 9;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  // Fallback points data from store if endpoint hasn't loaded yet
  const displayPoints = pointsData?.pokepoints ?? storePoints ?? 0;
  const displayLifetime = pointsData?.lifetimePoints ?? storeLifetime ?? 0;
  const displayRank = pointsData?.rank ?? { name: "Trainer", emoji: "🎒", color: "text-zinc-400" };
  const displayNextRank = pointsData?.nextRank ?? null;
  const displayProgress = pointsData?.rankProgress ?? 0;
  const displayHistory = pointsData?.history ?? [];
  const referralLink = referralCode ? `https://poke-cast.vercel.app/?ref=${encodeURIComponent(referralCode)}` : 'https://poke-cast.vercel.app';

  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 space-y-6 bg-zinc-950 text-white min-h-[calc(100vh-64px)]">
      
      {/* Header Profile */}
      <div className="flex items-center space-x-4">
        <div className="relative w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)] shrink-0">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-zinc-400" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          {username && <p className="text-zinc-500 text-sm">@{username}</p>}
          {fid && (
            <p className="text-[10px] font-mono text-zinc-600 mt-0.5">FID: {fid}</p>
          )}
        </div>
      </div>

      {/* PokePoints Premium Dashboard */}
      <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900/60 to-purple-950/80 rounded-2xl p-5 border border-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.15)] space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Loyalty Progression</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                {displayPoints.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-purple-400 font-mono">pts</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              Lifetime Earned: <span className="text-zinc-400">{displayLifetime}</span>
            </p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Collector Rank</span>
            <div className="flex items-center space-x-1.5 bg-zinc-950/50 px-3 py-1 rounded-full border border-indigo-500/10">
              <span className="text-base">{displayRank.emoji}</span>
              <span className={`text-xs font-extrabold ${displayRank.color}`}>
                {displayRank.name}
              </span>
            </div>
          </div>
        </div>

        {/* Rank progress bar */}
        <div className="space-y-2">
          <div className="w-full bg-zinc-950/80 rounded-full h-3 overflow-hidden border border-zinc-800/80 p-0.5">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
            <span>{displayProgress}% of Next Rank</span>
            {displayNextRank ? (
              <span className="text-purple-400 animate-pulse">
                {displayNextRank.minPoints - displayPoints} pts to {displayNextRank.emoji} {displayNextRank.name}
              </span>
            ) : (
              <span className="text-yellow-400 font-bold">✨ Max Rank Achieved! ✨</span>
            )}
          </div>
        </div>
      </div>

      {/* Referral Rewards Panel */}
      <div className="bg-zinc-900/40 rounded-2xl p-4 border border-zinc-800/60 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Referral Rewards</p>
            <h2 className="text-sm font-extrabold text-zinc-100 mt-1">Share your code, earn tickets</h2>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              Invite friends with your referral link. They get bonus tickets on their first pack, and you earn extra tickets when they play.
            </p>
          </div>
          <div className="flex-shrink-0 rounded-2xl bg-zinc-950/90 border border-fuchsia-500/20 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">
            {referralCode || 'PENDING'}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">Referrals</p>
            <p className="mt-2 text-2xl font-black text-fuchsia-300">{totalReferrals}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">Success</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{successfulReferrals}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">Tickets</p>
            <p className="mt-2 text-2xl font-black text-amber-300">{referralTicketsEarned}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              if (!referralCode) return;
              navigator.clipboard.writeText(referralLink).catch(() => {});
            }}
          >
            {referralCode ? 'Copy Referral Link' : 'Referral Link Pending'}
          </Button>
          {referralCode && (
            <Button
              size="sm"
              className="w-full sm:w-auto bg-fuchsia-500 text-white hover:bg-fuchsia-600"
              onClick={() => {
                const text = `Join me on PokéCast and earn bonus tickets with code ${referralCode}: ${referralLink}`;
                const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(referralLink)}`;
                if (sdk && typeof sdk.actions.openUrl === 'function') {
                  sdk.actions.openUrl(url).catch(() => window.open(url, '_blank'));
                } else {
                  window.open(url, '_blank');
                }
              }}
            >
              Share Referral
            </Button>
          )}
        </div>
      </div>

      {/* Classic stats */}
      <div className="bg-zinc-900/40 rounded-2xl p-4 border border-zinc-800/80">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center text-zinc-300">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            Collection Score
          </h2>
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            {collectionScore.toLocaleString()}
          </span>
        </div>
        
        <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800/80">
          <div 
            className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((collectionScore / 1000) * 100, 100)}%` }}
          />
        </div>
        <p className="text-right text-[10px] text-zinc-500 mt-1 font-mono">
          Tier: {collectionScore > 1000 ? 'Master' : collectionScore > 500 ? 'Ultra' : collectionScore > 100 ? 'Great' : 'Beginner'}
        </p>
      </div>

      {/* Stats details grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <Layers className="w-5 h-5 text-blue-400 mb-1" />
            <span className="text-xl font-bold font-mono">{uniqueCards}</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Unique Cards</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <Trophy className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-xl font-bold font-mono">{totalCards}</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Total Cards</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 9H9v6h6V9z"/></svg>
            <span className="text-xl font-bold font-mono">{Math.max(0, totalCards - uniqueCards)}</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Duplicates</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            <span className="text-xl font-bold font-mono">{Object.keys(wishlist).length}</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Wishlist</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80 col-span-2">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <PackageOpen className="w-5 h-5 text-purple-400 mb-1" />
            <span className="text-xl font-bold font-mono">{packsOpened}</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Packs Opened</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <span className="text-xl mb-1">🔥</span>
            <span className="text-lg font-bold font-mono text-orange-400">{loginStreak} Days</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Current Streak</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1 text-center">
            <span className="text-xl mb-1">🏆</span>
            <span className="text-lg font-bold font-mono text-yellow-400">{highestStreak} Days</span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Highest Streak</span>
          </CardContent>
        </Card>
      </div>

      {/* Top Up Banner */}
      <Link href="/topup" className="block">
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-fuchsia-500/10 border border-amber-500/25 hover:border-amber-500/40 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 group active:scale-[0.98]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Ticket className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Top Up Pack Tickets</h3>
              <p className="text-[11px] text-zinc-400">Get 10 Pack Tickets for $1.00 USD</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
            <span>Buy Now</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Tabs Selector for Achievements, Leaderboard, Points History */}
      <div className="flex border-b border-zinc-850">
        <button
          onClick={() => setActiveTab("achievements")}
          className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
            activeTab === "achievements"
              ? "text-fuchsia-400 border-fuchsia-500"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Badges</span>
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
            activeTab === "leaderboard"
              ? "text-indigo-400 border-indigo-500"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <List className="w-4 h-4" />
          <span>Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
            activeTab === "history"
              ? "text-purple-400 border-purple-500"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pb-12">
        {activeTab === "achievements" && (
          <div className="space-y-4">
            {/* Achievements Progress Card */}
            <div className="bg-zinc-900/20 rounded-2xl p-4 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center text-zinc-300 text-xs uppercase tracking-wider font-mono">
                  Progress
                </h2>
                <span className="text-sm font-bold font-mono text-fuchsia-400">
                  {unlockedCount} / {totalCount}
                </span>
              </div>
              
              <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800/80">
                <div 
                  className="bg-gradient-to-r from-fuchsia-500 to-violet-600 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>{progressPercent}% Completed</span>
                <span>
                  {(() => {
                    if (unlockedCount === totalCount && totalCount > 0) return "Grandmaster";
                    if (unlockedCount >= 6) return "Elite Trainer";
                    if (unlockedCount >= 3) return "Great Trainer";
                    if (unlockedCount >= 1) return "Novice Trainer";
                    return "Beginner";
                  })()}
                </span>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {achievements.length > 0 ? (
                achievements.map((ach) => {
                  const isUnlocked = ach.unlocked;
                  return (
                    <div 
                      key={ach.id} 
                      className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ${
                        isUnlocked 
                          ? 'bg-zinc-900/30 border-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.05)]' 
                          : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${
                        isUnlocked 
                          ? 'bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-white border border-fuchsia-500/30' 
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                      }`}>
                        {isUnlocked ? ach.icon : '🔒'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-semibold truncate ${isUnlocked ? 'text-zinc-100' : 'text-zinc-500'}`}>
                            {ach.title}
                          </p>
                          {isUnlocked ? (
                            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              ✓ Unlocked
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">
                              Locked
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 leading-normal ${isUnlocked ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {ach.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ach.badge_name && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-colors ${
                              isUnlocked 
                                ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20' 
                                : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/80'
                            }`}>
                              🏅 {ach.badge_name}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-colors ${
                            isUnlocked 
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' 
                              : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/80'
                          }`}>
                            🎟️ +{ach.reward_value} Tickets
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-colors ${
                            isUnlocked 
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20' 
                              : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/80'
                          }`}>
                            ✨ +25 PokePoints
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-6 text-zinc-500 text-xs">Loading achievements...</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/40 border-b border-zinc-850 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Rankings</span>
              <span className="text-[10px] text-zinc-500 font-mono">Top 50 Players</span>
            </div>
            
            <div className="divide-y divide-zinc-900/80 max-h-[350px] overflow-y-auto">
              {leaderboard.length > 0 ? (
                leaderboard.map((item) => {
                  const isCurrentUser = item.userId === userId;
                  const rankStyles = 
                    item.rank === 1 ? "text-yellow-400 bg-yellow-500/10 font-black border-yellow-500/20" :
                    item.rank === 2 ? "text-zinc-300 bg-zinc-400/10 font-bold border-zinc-400/20" :
                    item.rank === 3 ? "text-amber-600 bg-amber-700/10 font-bold border-amber-700/20" :
                    "text-zinc-500 bg-zinc-900/40 border-zinc-850";

                  return (
                    <div 
                      key={item.userId} 
                      className={`flex items-center justify-between p-3.5 transition-colors ${
                        isCurrentUser ? "bg-indigo-500/10" : "hover:bg-zinc-900/30"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border ${rankStyles}`}>
                          {item.rank}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                          {item.avatar ? (
                            <img src={item.avatar} alt={item.username} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold bg-zinc-700">
                              {item.username.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <span className={`text-sm font-semibold block truncate ${isCurrentUser ? "text-indigo-300 font-bold" : "text-zinc-200"}`}>
                            {item.username}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {item.collectorRank?.emoji} {item.collectorRank?.name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right pl-2">
                        <span className="text-sm font-bold font-mono text-indigo-400 block">{item.pokepoints}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">PokePoints</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-8 text-zinc-500 text-xs">Loading leaderboard...</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/40 border-b border-zinc-850 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Loyalty Feed</span>
              <span className="text-[10px] text-zinc-500 font-mono">Recent Earnings</span>
            </div>
            
            <div className="divide-y divide-zinc-900/80 max-h-[350px] overflow-y-auto">
              {displayHistory.length > 0 ? (
                displayHistory.map((item: any) => {
                  const isPositive = item.points >= 0;
                  const pointColor = isPositive ? "text-emerald-400" : "text-rose-400";
                  
                  // Label formatting
                  let actionLabel = item.action_type;
                  if (item.action_type === "pack_open") actionLabel = "Pack Opened 🎴";
                  else if (item.action_type === "card_pulls") actionLabel = "Rarity Card Pulls 💎";
                  else if (item.action_type === "login_day1") actionLabel = "Daily Login Streak Day 1 🎒";
                  else if (item.action_type === "login_day7") actionLabel = "Login Streak Milestone Day 7 ⭐";
                  else if (item.action_type === "login_day30") actionLabel = "Login Streak Milestone Day 30 👑";
                  else if (item.action_type === "share") actionLabel = "Shared Pulled Card 📱";
                  else if (item.action_type === "trade_complete") actionLabel = "Completed Trade accepted 🤝";
                  else if (item.action_type === "marketplace_listing") actionLabel = "Listed Card on Market 🪙";
                  else if (item.action_type === "marketplace_sale") actionLabel = "Marketplace Card Sold 🎉";
                  else if (item.action_type === "achievement") actionLabel = `Unlocked Badge: ${item.metadata?.title || 'Achievement'} 🏆`;
                  else if (item.action_type === "set_completion") actionLabel = `Set milestone: ${item.metadata?.setName || 'Set'} ${item.metadata?.milestone || ''} 🏅`;
                  else if (item.action_type === "admin_add") actionLabel = "Granted by Admin 🛠️";
                  else if (item.action_type === "admin_remove") actionLabel = "Revoked by Admin 🛠️";

                  return (
                    <div key={item.id} className="flex items-center justify-between p-3.5 hover:bg-zinc-900/10">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-zinc-200 block truncate">
                          {actionLabel}
                        </span>
                        {item.metadata?.reason && (
                          <span className="text-[10px] text-zinc-500 block truncate italic">
                            "{item.metadata.reason}"
                          </span>
                        )}
                        <span className="text-[9px] text-zinc-600 font-mono block">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="text-right pl-4">
                        <span className={`text-xs font-extrabold font-mono ${pointColor}`}>
                          {isPositive ? "+" : ""}{item.points}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-8 text-zinc-500 text-xs">No points history yet. Open packs or trade to earn points!</div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

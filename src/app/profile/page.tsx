"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { User, Trophy, PackageOpen, Layers } from "lucide-react";
import { useCollectionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";

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
    highestStreak = 0
  } = useCollectionStore();

  const [loadingAchievements, setLoadingAchievements] = useState(false);

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

    fetchAchievements();
  }, [userId, setAchievements]);

  const totalCards = Object.values(ownedCards).reduce((a, b) => a + b, 0);
  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : "Trainer";

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length || 9;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 space-y-6 bg-zinc-950 text-white min-h-[calc(100vh-64px)]">
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
          Rank: {collectionScore > 1000 ? 'Master' : collectionScore > 500 ? 'Ultra' : collectionScore > 100 ? 'Great' : 'Beginner'}
        </p>
      </div>

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

      {/* Achievements Progress Card */}
      <div className="bg-zinc-900/40 rounded-2xl p-4 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center text-zinc-300">
            <Trophy className="w-5 h-5 mr-2 text-fuchsia-500" />
            Achievements Progress
          </h2>
          <span className="text-lg font-bold font-mono text-fuchsia-400">
            {unlockedCount} / {totalCount}
          </span>
        </div>
        
        <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800/80">
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

      <div className="pt-2 flex-1 pb-8">
        <h3 className="text-sm font-bold mb-4 px-1 text-zinc-300 flex items-center justify-between">
          <span>All Achievements</span>
          {loadingAchievements && (
            <span className="text-[10px] text-zinc-500 font-mono animate-pulse uppercase">Syncing...</span>
          )}
        </h3>
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
                          ✓ Claimed
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
                    
                    {/* Badge and Rewards */}
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
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/20 rounded-xl border border-zinc-800/40 text-center">
              <span className="text-2xl mb-2">⚡</span>
              <p className="text-sm text-zinc-400 font-medium">No achievements found</p>
              <p className="text-xs text-zinc-600 mt-1">Start playing to load achievements!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

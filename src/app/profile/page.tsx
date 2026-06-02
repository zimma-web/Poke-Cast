"use client";

import Image from "next/image";
import { User, Trophy, PackageOpen, Layers } from "lucide-react";
import { useCollectionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfileScreen() {
  const { 
    username, 
    avatar, 
    fid, 
    ownedCards, 
    uniqueCards, 
    collectionScore, 
    packsOpened 
  } = useCollectionStore();

  const totalCards = Object.values(ownedCards).reduce((a, b) => a + b, 0);
  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : "Trainer";

  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 space-y-6 bg-zinc-950 text-white min-h-[calc(100vh-64px)]">
      <div className="flex items-center space-x-4">
        <div className="relative w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)] shrink-0">
          {avatar ? (
            <Image src={avatar} alt={displayName} fill className="object-cover" />
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
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1">
            <Layers className="w-6 h-6 text-blue-400 mb-1" />
            <span className="text-2xl font-bold">{uniqueCards}</span>
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Unique Cards</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1">
            <Trophy className="w-6 h-6 text-emerald-400 mb-1" />
            <span className="text-2xl font-bold">{totalCards}</span>
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Total Cards</span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800/80 col-span-2">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-1">
            <PackageOpen className="w-6 h-6 text-purple-400 mb-1" />
            <span className="text-2xl font-bold">{packsOpened}</span>
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Packs Opened</span>
          </CardContent>
        </Card>
      </div>

      <div className="pt-4 flex-1">
        <h3 className="text-sm font-bold mb-3 px-1 text-zinc-300">Recent Achievements</h3>
        <div className="space-y-3">
          {packsOpened > 0 ? (
            <div className="flex items-center space-x-3 bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/40">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <PackageOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">First Pack Opened</p>
                <p className="text-[11px] text-zinc-500">The journey begins.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 px-1">Open a pack to earn achievements!</p>
          )}

          {uniqueCards >= 10 && (
            <div className="flex items-center space-x-3 bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/40">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Collector I</p>
                <p className="text-[11px] text-zinc-500">Obtain 10 unique cards.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

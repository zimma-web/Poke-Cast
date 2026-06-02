"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [stats, setStats] = useState({ cards: 0, sets: 0, loading: true });

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

  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">PokéCast</h1>
        <p className="text-muted-foreground text-sm">Your ultimate card collection journey.</p>
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
    </div>
  );
}

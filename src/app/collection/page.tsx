"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useInView } from "react-intersection-observer";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function CollectionScreen() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  
  const { ref, inView } = useInView();
  const ownedCards = useCollectionStore(state => state.ownedCards);

  useEffect(() => {
    fetch('/api/sets').then(res => res.json()).then(data => setSets(data.sets));
  }, []);

  const fetchCards = async (pageNum: number, searchQuery: string, setId: string | undefined, reset: boolean = false) => {
    if (loading) return;
    setLoading(true);
    try {
      let url = `/api/cards?page=${pageNum}&limit=30&q=${encodeURIComponent(searchQuery)}`;
      if (setId) url += `&set=${setId}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (reset) {
        setCards(data.cards);
      } else {
        setCards(prev => [...prev, ...data.cards]);
      }
      
      setHasMore(pageNum < data.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCards(1, search, selectedSet?.id, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, selectedSet]);

  useEffect(() => {
    if (inView && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchCards(nextPage, search, selectedSet?.id, false);
    }
  }, [inView, hasMore, loading, selectedSet]);

  const groupedSets = sets.reduce((acc, set) => {
    acc[set.series] = acc[set.series] || [];
    acc[set.series].push(set);
    return acc;
  }, {} as Record<string, any[]>);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.dataset.isDown = "true";
    el.dataset.startX = String(e.pageX - el.offsetLeft);
    el.dataset.scrollLeft = String(el.scrollLeft);
    el.dataset.walk = "0";
    el.style.cursor = "grabbing";
  };

  const handleDragEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.dataset.isDown = "false";
    el.style.cursor = "grab";
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.dataset.isDown !== "true") return;
    const startX = Number(el.dataset.startX);
    const scrollLeft = Number(el.dataset.scrollLeft);
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.dataset.walk = String(walk);
    el.scrollLeft = scrollLeft - walk;
  };

  const handleChipClick = (e: React.MouseEvent, action: () => void) => {
    const container = e.currentTarget.parentElement;
    if (container) {
      const walk = Math.abs(Number(container.dataset.walk || 0));
      if (walk > 8) {
        container.dataset.walk = "0";
        return;
      }
    }
    action();
  };

  const totalOwned = Object.values(ownedCards).reduce((a, b) => a + b, 0);
  const uniqueOwned = Object.keys(ownedCards).length;
  const completionRate = ((uniqueOwned / 20359) * 100).toFixed(2);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-zinc-950 text-white">
      <div className="shrink-0 bg-background/95 backdrop-blur-md p-4 space-y-3 border-b border-border/10 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
        </div>

        {/* Global Collection Statistics Row */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-2.5 text-center">
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Total Cards</p>
            <p className="text-sm font-bold text-zinc-200">{totalOwned}</p>
          </div>
          <div className="border-x border-zinc-800/80">
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Unique</p>
            <p className="text-sm font-bold text-zinc-200">{uniqueOwned}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Completion</p>
            <p className="text-sm font-bold text-fuchsia-500">{completionRate}%</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input 
            placeholder="Search cards..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200 rounded-full h-10 placeholder:text-zinc-500 focus-visible:ring-fuchsia-500"
          />
        </div>

        {/* Series Horizontal Scroll */}
        <div 
          className="flex overflow-x-auto gap-2 pb-1 no-scrollbar -mx-4 px-4 select-none cursor-grab active:cursor-grabbing"
          style={{ WebkitOverflowScrolling: "touch" }}
          onMouseDown={handleDragStart}
          onMouseLeave={handleDragEnd}
          onMouseUp={handleDragEnd}
          onMouseMove={handleDragMove}
        >
          <button
            onClick={(e) => handleChipClick(e, () => {
              setSelectedSeries(null);
              setSelectedSet(null);
            })}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
              !selectedSeries 
                ? "bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
          >
            All Series
          </button>
          {Object.keys(groupedSets).map((series) => (
            <button
              key={series}
              onClick={(e) => handleChipClick(e, () => {
                setSelectedSeries(series);
                setSelectedSet(null);
              })}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                selectedSeries === series 
                  ? "bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              )}
            >
              {series}
            </button>
          ))}
        </div>

        {/* Sets Horizontal Scroll */}
        {selectedSeries && groupedSets[selectedSeries] && (
          <div 
            className="flex overflow-x-auto gap-2 pb-1 no-scrollbar -mx-4 px-4 animate-in fade-in slide-in-from-top-1 duration-200 select-none cursor-grab active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: "touch" }}
            onMouseDown={handleDragStart}
            onMouseLeave={handleDragEnd}
            onMouseUp={handleDragEnd}
            onMouseMove={handleDragMove}
          >
            {groupedSets[selectedSeries].map((set: any) => {
              const ownedCount = Object.keys(ownedCards).filter(id => id.startsWith(`${set.id}-`)).length;
              return (
                <button
                  key={set.id}
                  onClick={(e) => handleChipClick(e, () => setSelectedSet(set))}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                    selectedSet?.id === set.id 
                      ? "bg-zinc-100 border-zinc-100 text-zinc-950" 
                      : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-zinc-100"
                  )}
                >
                  {set.symbol && (
                    <span className="relative w-3.5 h-3.5 inline-block shrink-0 bg-white/10 p-0.5 rounded-sm">
                      <Image src={set.symbol} alt="" fill className="object-contain" />
                    </span>
                  )}
                  {set.name} ({ownedCount} / {set.totalCards})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {selectedSet && (
          <div className="relative w-full py-8 flex flex-col items-center justify-center overflow-hidden border-b border-zinc-800/50 shrink-0">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-zinc-950 z-0" />
            <div className="relative z-10 flex flex-col items-center px-4">
              {selectedSet.logo && (
                <div className="relative w-48 h-20 mb-4 drop-shadow-2xl">
                  <Image src={selectedSet.logo} alt="logo" fill className="object-contain" />
                </div>
              )}
              <div className="flex items-center space-x-2 mb-2">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{selectedSet.name}</h2>
                <div className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-400">
                  {selectedSet.id.toUpperCase()}
                </div>
              </div>
              
              <div className="flex items-center justify-center text-xs text-zinc-400 gap-3 mb-2">
                {selectedSet.symbol && (
                  <div className="relative w-5 h-5 bg-white/10 p-0.5 rounded backdrop-blur-sm">
                    <Image src={selectedSet.symbol} alt="symbol" fill className="object-contain" />
                  </div>
                )}
                <span>{selectedSet.series}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span>{Object.keys(ownedCards).filter(id => id.startsWith(`${selectedSet.id}-`)).length} / {selectedSet.totalCards} collected</span>
              </div>
              <p className="text-xs text-zinc-600">Released {selectedSet.releaseDate}</p>
            </div>
          </div>
        )}

        <div className="p-4 grid grid-cols-2 gap-4">
          {cards.map((card) => {
            const isOwned = !!ownedCards[card.id];

            return (
              <div key={card.id} className="flex flex-col group cursor-pointer">
                <div className={cn(
                  "relative aspect-[2.5/3.5] rounded-xl overflow-hidden mb-2 transition-all duration-300", 
                  isOwned ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(217,70,239,0.3)]" : "opacity-75 grayscale-[0.3]"
                )}>
                  {card.smallImage ? (
                    <Image 
                      src={card.smallImage} 
                      alt={card.name}
                      fill
                      sizes="(max-width: 390px) 50vw, 33vw"
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center p-2 text-center text-[10px] text-zinc-600">
                      Missing Image
                    </div>
                  )}
                </div>
                
                <div className="text-center px-1">
                  <p className="text-[13px] font-bold text-zinc-200 truncate">
                    {card.name} <span className="text-zinc-500 text-[11px]">#{card.number}</span>
                  </p>
                  <p className="text-[11px] font-bold mt-0.5 text-fuchsia-500/90 flex items-center justify-center gap-1">
                    {isOwned ? "Owned" : <span className="text-zinc-600 font-normal">{card.rarity || 'Common'}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-4 p-4 mt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col">
                <Skeleton className="aspect-[2.5/3.5] rounded-xl mb-2 bg-zinc-800" />
                <Skeleton className="h-4 w-3/4 mx-auto mb-1 bg-zinc-800" />
                <Skeleton className="h-3 w-1/2 mx-auto bg-zinc-800" />
              </div>
            ))}
          </div>
        )}
        
        <div ref={ref} className="h-10 w-full mt-4" />
      </div>
    </div>
  );
}

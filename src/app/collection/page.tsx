"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useInView } from "react-intersection-observer";
import { Search, X, ExternalLink, Zap, Shield, Swords, Star, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Type badge colors ─────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Fire:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Water:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Grass:     "bg-green-500/20 text-green-300 border-green-500/30",
  Lightning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Psychic:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Fighting:  "bg-red-700/20 text-red-300 border-red-700/30",
  Darkness:  "bg-zinc-700/40 text-zinc-300 border-zinc-600/30",
  Metal:     "bg-slate-500/20 text-slate-300 border-slate-500/30",
  Dragon:    "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  Fairy:     "bg-pink-500/20 text-pink-300 border-pink-500/30",
  Colorless: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};

// ─── Rarity color ──────────────────────────────────────────────────────────────
function rarityColor(rarity: string | null) {
  if (!rarity) return "text-zinc-500";
  const r = rarity.toLowerCase();
  if (r.includes("secret") || r.includes("rainbow") || r.includes("special illustration")) return "text-amber-400";
  if (r.includes("illustration rare")) return "text-fuchsia-400";
  if (r.includes("ultra rare") || r.includes("alt art") || r.includes("vstar")) return "text-violet-400";
  if (r.includes("rare holo")) return "text-sky-400";
  if (r.includes("rare")) return "text-blue-400";
  if (r.includes("uncommon")) return "text-green-400";
  return "text-zinc-500";
}

// ─── Card Detail Modal ─────────────────────────────────────────────────────────
function CardDetailModal({ card, owned, wishlisted, onClose, onToggleWishlist }: {
  card: CardType & { hp?: number; types?: string[]; attacks?: any[]; weaknesses?: any[]; resistances?: any[]; artist?: string; flavorText?: string; tcgplayerUrl?: string };
  owned: number;
  wishlisted: boolean;
  onClose: () => void;
  onToggleWishlist: () => void;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [fullCard, setFullCard] = useState<any>(null);

  useEffect(() => {
    // Fetch extended card data from pokemontcg.io
    fetch(`https://api.pokemontcg.io/v2/cards/${card.id}`)
      .then(r => r.json())
      .then(data => setFullCard(data?.data || null))
      .catch(() => {});
    
    // Fetch price from our backend
    fetch(`/api/card-price?cardId=${encodeURIComponent(card.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.price > 0) { setPrice(data.price); setPriceSource(data.source); }
      })
      .catch(() => {})
      .finally(() => setLoadingPrice(false));
  }, [card.id]);

  const attacks = fullCard?.attacks || [];
  const types = fullCard?.types || (card as any).types || [];
  const hp = fullCard?.hp || (card as any).hp;
  const weaknesses = fullCard?.weaknesses || [];
  const resistances = fullCard?.resistances || [];
  const artist = fullCard?.artist;
  const flavorText = fullCard?.flavorText;
  const setInfo = fullCard?.set;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-zinc-950/90 backdrop-blur-sm flex flex-col"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", bounce: 0.12, duration: 0.5 }}
          className="absolute inset-x-0 bottom-0 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl overflow-hidden max-h-[94vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-2">
              {setInfo?.images?.symbol && (
                <div className="relative w-5 h-5">
                  <Image src={setInfo.images.symbol} alt="" fill className="object-contain" />
                </div>
              )}
              <span className="text-xs text-zinc-500 font-mono">{setInfo?.name || card.id}</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Card image + name hero */}
            <div className="relative flex flex-col items-center pt-6 pb-4 px-4">
              {/* Glowing background */}
              <div className={cn("absolute inset-0 opacity-20 blur-3xl -z-0", types[0] ? "" : "")}
                style={{ background: types[0] === "Fire" ? "radial-gradient(ellipse at 50% 30%, #f97316, transparent)" :
                  types[0] === "Water" ? "radial-gradient(ellipse at 50% 30%, #3b82f6, transparent)" :
                  types[0] === "Grass" ? "radial-gradient(ellipse at 50% 30%, #22c55e, transparent)" :
                  types[0] === "Lightning" ? "radial-gradient(ellipse at 50% 30%, #eab308, transparent)" :
                  types[0] === "Psychic" ? "radial-gradient(ellipse at 50% 30%, #a855f7, transparent)" :
                  "radial-gradient(ellipse at 50% 30%, #a855f7, transparent)"
                }}
              />

              {/* Large card image */}
              <div className="relative w-52 h-72 z-10 drop-shadow-[0_8px_30px_rgba(0,0,0,0.8)]">
                <Image
                  src={card.largeImage || card.smallImage || ""}
                  alt={card.name}
                  fill
                  className="object-contain rounded-xl"
                />
              </div>

              {/* Owned badge */}
              {owned > 0 && (
                <div className="mt-3 z-10 flex items-center gap-1.5 px-3 py-1 bg-fuchsia-600/20 border border-fuchsia-500/30 rounded-full">
                  <Star className="w-3 h-3 text-fuchsia-400 fill-fuchsia-400" />
                  <span className="text-xs font-bold text-fuchsia-300">You own ×{owned}</span>
                </div>
              )}
            </div>

            {/* Card name & meta */}
            <div className="px-5 pb-2 text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white">{card.name}</h2>
                {hp && <span className="text-sm font-bold text-zinc-400">HP {hp}</span>}
              </div>
              <p className={cn("text-sm font-semibold mt-1", rarityColor(card.rarity || null))}>{card.rarity || "Common"}</p>
              {/* Type chips */}
              {types.length > 0 && (
                <div className="flex justify-center gap-2 mt-2">
                  {types.map((t: string) => (
                    <span key={t} className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", TYPE_COLORS[t] || TYPE_COLORS.Colorless)}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price card */}
            <div className="mx-4 mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Market Price</p>
              </div>
              {loadingPrice ? (
                <Skeleton className="h-8 w-24 bg-zinc-800" />
              ) : price ? (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black text-white">${price.toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {priceSource === "tcgplayer" ? "TCGPlayer market" :
                       priceSource === "cardmarket" ? "Cardmarket avg" :
                       priceSource === "scrydex" ? "Scrydex market" :
                       "Estimated by rarity"}
                    </p>
                  </div>
                  <a
                    href={`https://prices.pokemontcg.io/tcgplayer/${card.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-400 hover:bg-blue-600/30 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> TCGPlayer
                  </a>
                </div>
              ) : (
                <p className="text-zinc-600 text-sm">No price data available</p>
              )}
            </div>

            {/* Attacks */}
            {attacks.length > 0 && (
              <div className="mx-4 mb-4">
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-2 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" /> Attacks
                </p>
                <div className="space-y-2">
                  {attacks.map((atk: any, i: number) => (
                    <div key={i} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {atk.cost?.map((c: string, j: number) => (
                              <span key={j} className="text-[9px] px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">{c[0]}</span>
                            ))}
                          </div>
                          <span className="text-sm font-bold text-zinc-200">{atk.name}</span>
                        </div>
                        {atk.damage && <span className="text-sm font-black text-white">{atk.damage}</span>}
                      </div>
                      {atk.text && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{atk.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses & Resistances */}
            {(weaknesses.length > 0 || resistances.length > 0) && (
              <div className="mx-4 mb-4 grid grid-cols-2 gap-3">
                {weaknesses.length > 0 && (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-rose-500 mb-1.5 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Weakness
                    </p>
                    {weaknesses.map((w: any, i: number) => (
                      <span key={i} className="text-sm font-bold text-zinc-200">{w.type} {w.value}</span>
                    ))}
                  </div>
                )}
                {resistances.length > 0 && (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-green-500 mb-1.5 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Resistance
                    </p>
                    {resistances.map((r: any, i: number) => (
                      <span key={i} className="text-sm font-bold text-zinc-200">{r.type} {r.value}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Flavor text */}
            {flavorText && (
              <div className="mx-4 mb-4 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
                <p className="text-[12px] text-zinc-400 italic leading-relaxed">"{flavorText}"</p>
              </div>
            )}

            {/* Card info footer */}
            <div className="mx-4 mb-6 p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-600 font-mono">Card ID</p>
                <p className="text-xs font-mono text-zinc-400">{card.id}</p>
              </div>
              {artist && (
                <div className="text-right">
                  <p className="text-[10px] text-zinc-600 font-mono">Artist</p>
                  <p className="text-xs text-zinc-400">{artist}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom action: Wishlist */}
          <div className="p-4 border-t border-zinc-800 shrink-0">
            <button
              onClick={onToggleWishlist}
              className={cn(
                "w-full h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                wishlisted
                  ? "bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                fill={wishlisted ? "currentColor" : "none"} stroke="currentColor"
                strokeWidth="2.5" className="w-4 h-4">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              {wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function CollectionScreen() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  
  const { ref, inView } = useInView();
  const ownedCards = useCollectionStore(state => state.ownedCards);
  const userId = useCollectionStore(state => state.userId);
  const wishlist = useCollectionStore(state => state.wishlist) || {};
  const toggleWishlist = useCollectionStore(state => state.toggleWishlist);

  const handleToggleWishlist = async (cardId: string) => {
    if (!userId) return;
    toggleWishlist(cardId);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cardId })
      });
      const data = await res.json();
      if (!data.success) toggleWishlist(cardId);
    } catch (e) {
      console.error(e);
      toggleWishlist(cardId);
    }
  };

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
      if (reset) setCards(data.cards);
      else setCards(prev => [...prev, ...data.cards]);
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
      if (walk > 8) { container.dataset.walk = "0"; return; }
    }
    action();
  };

  const totalOwned = Object.values(ownedCards).reduce((a, b) => a + b, 0);
  const uniqueOwned = Object.keys(ownedCards).length;
  const duplicateCount = Math.max(0, totalOwned - uniqueOwned);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-zinc-950 text-white">
      {/* Card detail modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          owned={ownedCards[selectedCard.id] || 0}
          wishlisted={!!wishlist[selectedCard.id]}
          onClose={() => setSelectedCard(null)}
          onToggleWishlist={() => handleToggleWishlist(selectedCard.id)}
        />
      )}

      <div className="shrink-0 bg-background/95 backdrop-blur-md p-4 space-y-3 border-b border-border/10 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
        </div>

        {/* Global Collection Statistics Row */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-2.5 text-center">
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Total Copies</p>
            <p className="text-sm font-bold text-zinc-200">{totalOwned}</p>
          </div>
          <div className="border-x border-zinc-800/80">
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Unique Cards</p>
            <p className="text-sm font-bold text-zinc-200">{uniqueOwned}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Duplicate Count</p>
            <p className="text-sm font-bold text-fuchsia-500">{duplicateCount}</p>
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
          onMouseDown={handleDragStart} onMouseLeave={handleDragEnd}
          onMouseUp={handleDragEnd} onMouseMove={handleDragMove}
        >
          <button
            onClick={(e) => handleChipClick(e, () => { setSelectedSeries(null); setSelectedSet(null); })}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
              !selectedSeries ? "bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
          >All Series</button>
          {Object.keys(groupedSets).map((series) => (
            <button key={series}
              onClick={(e) => handleChipClick(e, () => { setSelectedSeries(series); setSelectedSet(null); })}
              className={cn("px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                selectedSeries === series ? "bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              )}
            >{series}</button>
          ))}
        </div>

        {/* Sets Horizontal Scroll */}
        {selectedSeries && groupedSets[selectedSeries] && (
          <div 
            className="flex overflow-x-auto gap-2 pb-1 no-scrollbar -mx-4 px-4 animate-in fade-in slide-in-from-top-1 duration-200 select-none cursor-grab active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: "touch" }}
            onMouseDown={handleDragStart} onMouseLeave={handleDragEnd}
            onMouseUp={handleDragEnd} onMouseMove={handleDragMove}
          >
            {groupedSets[selectedSeries].map((set: any) => {
              const ownedCount = Object.keys(ownedCards).filter(id => id.startsWith(`${set.id}-`)).length;
              return (
                <button key={set.id}
                  onClick={(e) => handleChipClick(e, () => setSelectedSet(set))}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                    selectedSet?.id === set.id ? "bg-zinc-100 border-zinc-100 text-zinc-950" : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-zinc-100"
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
            const isWishlisted = !!wishlist[card.id];

            return (
              <div key={card.id} className="flex flex-col group cursor-pointer relative"
                onClick={() => setSelectedCard(card)}>
                <div className="relative aspect-[2.5/3.5] mb-2">
                  <div className={cn(
                    "w-full h-full rounded-xl overflow-hidden transition-all duration-300",
                    isOwned ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(217,70,239,0.3)]" : "opacity-75 grayscale-[0.3]"
                  )}>
                    {card.smallImage ? (
                      <Image src={card.smallImage} alt={card.name} fill
                        sizes="(max-width: 390px) 50vw, 33vw" className="object-contain" />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center p-2 text-center text-[10px] text-zinc-600">
                        Missing Image
                      </div>
                    )}
                  </div>

                  {/* Wishlist Heart */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleWishlist(card.id); }}
                    className="absolute -top-1.5 -right-1.5 z-10 p-1.5 rounded-full bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-white transition-colors backdrop-blur-xs shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                      fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={cn("w-3.5 h-3.5 transition-transform active:scale-75", isWishlisted ? "text-rose-500" : "text-zinc-400")}>
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                  </button>

                  {/* Owned Count Badge */}
                  {isOwned && (
                    <div className="absolute -top-1.5 -left-1.5 z-10 min-w-[20px] h-[20px] bg-fuchsia-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1.5 border border-fuchsia-500 shadow-md">
                      ×{ownedCards[card.id]}
                    </div>
                  )}
                </div>

                <div className="text-center px-1">
                  <p className="text-[13px] font-bold text-zinc-200 truncate">
                    {card.name} <span className="text-zinc-500 text-[11px]">#{card.number}</span>
                  </p>
                  <p className={cn("text-[11px] font-bold mt-0.5", rarityColor(card.rarity || null))}>
                    {card.rarity || "Common"}
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

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { Loader2, Share2, Sparkles, Minus, Plus } from "lucide-react";
import sdk from "@farcaster/frame-sdk";
import Link from "next/link";

const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';
const FEE_PER_PACK_WEI = BigInt(1000000000000); // 0.000001 ETH per pack

export default function PackScreen() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [packCount, setPackCount] = useState(1); // 1-5 packs
  const [isOpen, setIsOpen] = useState(false);
  const [packArtError, setPackArtError] = useState(false);

  useEffect(() => {
    setPackArtError(false);
  }, [selectedSetId]);
  
  const addCards = useCollectionStore(state => state.addCards);
  const ownedCards = useCollectionStore(state => state.ownedCards);
  const userId = useCollectionStore(state => state.userId);
  const packTickets = useCollectionStore(state => state.packTickets);
  const freePacksRemaining = useCollectionStore(state => state.freePacksRemaining);
  const updateEconomy = useCollectionStore(state => state.updateEconomy);
  const walletAddress = useCollectionStore(state => state.walletAddress);
  
  const activeSet = sets.find(s => s.id === selectedSetId);
  const totalAvailable = (freePacksRemaining ?? 0) + (packTickets ?? 0);
  const maxPacks = Math.min(5, totalAvailable);

  useEffect(() => {
    fetch('/api/sets')
      .then(res => res.json())
      .then(data => {
        setSets(data.sets);
        if (data.sets && data.sets.length > 0) {
          setSelectedSetId(data.sets[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch sets:", err));
  }, []);

  // Clamp packCount when economy changes
  useEffect(() => {
    if (packCount > maxPacks && maxPacks > 0) setPackCount(maxPacks);
  }, [maxPacks]);

  const getSetProgress = (setId: string) => {
    const prefix = `${setId}-`;
    return Object.keys(ownedCards).filter(id => id.startsWith(prefix)).length;
  };

  const adjustCount = (delta: number) => {
    setPackCount(prev => Math.max(1, Math.min(maxPacks, prev + delta)));
  };

  const openPack = async () => {
    if (!selectedSetId || !userId) return;

    if (totalAvailable === 0) {
      setError("Not enough Pack Tickets or daily free packs.");
      return;
    }

    const count = Math.min(packCount, maxPacks);
    if (count < 1) return;

    setLoading(true);
    setError("");
    let txHash = "";

    const provider = sdk.wallet?.ethProvider;

    try {
      let senderAddress = walletAddress;
      if (provider && !senderAddress) {
        try {
          const ethAccounts = await provider.request({ method: 'eth_accounts' }) as string[];
          if (Array.isArray(ethAccounts) && ethAccounts.length > 0) {
            senderAddress = ethAccounts[0];
          }
        } catch (accountErr) {
          console.warn('Failed to read connected eth_accounts from provider:', accountErr);
        }
      }

      if (provider) {
        if (!senderAddress) {
          throw new Error("Wallet not connected. Please open the app again.");
        }

        // Total fee = count × 0.000001 ETH
        const totalWei = FEE_PER_PACK_WEI * BigInt(count);
        const gasHex = `0x${(21000).toString(16)}` as `0x${string}`;

        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: senderAddress as `0x${string}`,
            to: TREASURY_ADDRESS,
            value: `0x${totalWei.toString(16)}`,
            gas: gasHex,
            data: '0x'
          }]
        });
        txHash = tx as string;
      } else {
        // Mock fallback for dev environments
        console.warn("Wallet provider not found. Simulating transaction.");
        await new Promise(r => setTimeout(r, 800));
        txHash = "0xmock" + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      }

      // Open all packs in one request
      const res = await fetch("/api/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, setId: selectedSetId, txHash, count })
      });
      const data = await res.json();
      
      if (res.status === 400 || data.error) {
        setError(data.error || "Failed to process pack opening");
        return;
      }

      setCards(data.cards);
      addCards(data.cards);
      
      if (data.packTickets !== undefined && data.freePacksRemaining !== undefined) {
        updateEconomy({
          packTickets: data.packTickets,
          freePacksRemaining: data.freePacksRemaining,
          lastDailyReset: data.lastDailyReset
        });
      }

      setOpened(true);
      setCurrentIndex(0);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to open pack (transaction rejected or timed out)");
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const shareToFarcaster = () => {
    const card = cards[currentIndex];
    const text = `I just pulled ${card.name} (${card.rarity || 'Common'}) on PokéCast! 🎴✨`;
    const url = "https://poke-cast.vercel.app";
    try {
      if (sdk && typeof sdk.actions.openUrl === 'function') {
        sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
      } else {
        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`, '_blank');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Card reveal screen ─────────────────────────────────────────────────────
  if (opened) {
    const currentCard = cards[currentIndex];
    const packNumber = Math.floor(currentIndex / 5) + 1;
    const cardInPack = (currentIndex % 5) + 1;
    const totalPacks = Math.ceil(cards.length / 5);

    return (
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-zinc-950 px-4 pt-8">
        <div className="flex justify-between items-center mb-2 text-zinc-400 text-sm font-medium">
          <span className="font-mono text-xs">
            Pack {packNumber}/{totalPacks} · Card {cardInPack}/5
          </span>
          <span className="flex items-center text-amber-400 font-mono text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {currentCard.rarity || 'Common'}
          </span>
        </div>

        {/* Pack progress dots */}
        <div className="flex justify-center gap-1 mb-4">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'w-4 bg-fuchsia-500' :
                i < currentIndex ? 'w-2 bg-fuchsia-500/40' : 'w-2 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center relative perspective-1000">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
              className="relative w-full max-w-[320px] aspect-[2.5/3.5] group cursor-pointer"
              onClick={nextCard}
            >
              {currentCard.largeImage ? (
                <Image 
                  src={currentCard.largeImage} 
                  alt={currentCard.name}
                  fill
                  className="object-contain drop-shadow-2xl"
                  sizes="(max-width: 390px) 100vw, 320px"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 rounded-2xl flex items-center justify-center">
                  <span className="text-zinc-500">Image Missing</span>
                </div>
              )}
              
              {(currentCard.rarity?.includes('Rare') || currentCard.rarity?.includes('Holo')) && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent mix-blend-overlay rounded-2xl animate-shimmer pointer-events-none" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pb-8 pt-4 flex space-x-3">
          {currentIndex < cards.length - 1 ? (
            <Button size="lg" className="flex-1 rounded-full h-14 font-bold" onClick={nextCard}>
              Next Card
            </Button>
          ) : (
            <Button size="lg" className="flex-1 rounded-full h-14 font-bold" onClick={() => { setOpened(false); setCards([]); }}>
              Finish
            </Button>
          )}
          
          <Button size="lg" variant="secondary" className="w-14 h-14 rounded-full p-0" onClick={shareToFarcaster}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }


  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => setIsOpen(false);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [isOpen]);

  // ─── Pack selection screen ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
      {/* Economy Header */}
      <div className="flex items-center justify-between w-full max-w-[280px] px-4 py-2.5 mb-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
        <div className="flex flex-col items-center flex-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Free Packs</span>
          <span className="text-xs font-black text-fuchsia-400 font-mono mt-0.5">{freePacksRemaining} left</span>
        </div>
        <div className="h-6 w-[1px] bg-zinc-800" />
        <Link href="/topup" className="flex flex-col items-center flex-1 group hover:opacity-85 transition-opacity">
          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-amber-400 transition-colors uppercase tracking-wider">Pack Tickets</span>
          <span className="text-xs font-black text-amber-400 font-mono mt-0.5 flex items-center gap-1.5">
            🎟️ {packTickets}
            <span className="text-[9px] text-zinc-500 group-hover:text-amber-400 transition-colors bg-zinc-950 px-1.5 py-0.2 rounded border border-zinc-850">+</span>
          </span>
        </Link>
      </div>

      {/* Set Selector */}
      <div className="w-full max-w-[280px] mb-5 relative z-50">
        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2 text-center">
          Select Expansion Pack
        </label>
        
        {/* Custom Dropdown Trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="w-full flex items-center justify-between bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700/80 text-zinc-200 rounded-2xl h-14 px-4 text-left transition-all duration-200 shadow-lg focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            {activeSet?.logo ? (
              <div className="relative w-8 h-8 flex-shrink-0 bg-zinc-950 rounded-lg p-1 border border-zinc-800/50">
                <Image src={activeSet.logo} alt="" fill className="object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-fuchsia-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                TCG
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black truncate leading-tight text-white flex items-center gap-1.5">
                {activeSet?.name || "Select Set"}
                {activeSet?.featured_pack && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider border border-amber-500/30">
                    ★
                  </span>
                )}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Progress: {getSetProgress(selectedSetId)} / {activeSet?.totalCards || 0}
              </span>
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Options */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl mt-1.5 max-h-[260px] overflow-y-auto custom-scrollbar"
            >
              <div className="p-1.5 space-y-1">
                {sets.map((set) => {
                  const progress = getSetProgress(set.id);
                  const total = set.totalCards || 1;
                  const progressPercent = Math.min(100, Math.round((progress / total) * 100));
                  const isSelected = set.id === selectedSetId;
                  
                  return (
                    <button
                      key={set.id}
                      onClick={() => {
                        setSelectedSetId(set.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex flex-col p-2.5 rounded-xl transition-all text-left ${
                        isSelected 
                          ? "bg-fuchsia-500/10 border border-fuchsia-500/30 text-white" 
                          : "hover:bg-zinc-900/80 border border-transparent text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {set.logo ? (
                            <div className="relative w-7 h-7 flex-shrink-0 bg-zinc-900 rounded-md p-1 border border-zinc-800">
                              <Image src={set.logo} alt="" fill className="object-contain" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 flex-shrink-0 bg-zinc-800 rounded-md flex items-center justify-center text-[10px] font-bold text-zinc-400">
                              TCG
                            </div>
                          )}
                          <span className={`text-xs font-black truncate ${isSelected ? "text-fuchsia-300" : "text-zinc-200"}`}>
                            {set.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {set.featured_pack && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest border border-amber-500/30">
                              ★
                            </span>
                          )}
                          {isSelected && (
                            <svg className="w-4 h-4 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full space-y-1 pl-9">
                        <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                          <span>Collected: {progress}/{total}</span>
                          <span className={isSelected ? "text-fuchsia-400" : ""}>{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected ? "bg-gradient-to-r from-fuchsia-500 to-pink-500" : "bg-zinc-700"
                            }`} 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pack art */}
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [0, -1.5, 1.5, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        onClick={openPack}
        className="relative w-full max-w-[240px] aspect-[2.5/3.5] bg-gradient-to-tr from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-[24px] shadow-[0_0_40px_rgba(168,85,247,0.25)] flex flex-col items-center justify-center cursor-pointer mb-5 overflow-hidden group"
      >
        {/* Dynamic Background Image overlay if available */}
        {!packArtError ? (
          <div className="absolute inset-0 w-full h-full">
            <Image 
              src={`/images/packs/${selectedSetId}.webp`} 
              alt="" 
              fill 
              className="object-cover rounded-[24px] transition-transform duration-500 group-hover:scale-105"
              onError={() => setPackArtError(true)}
              priority
            />
            {/* Dark vignette gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-zinc-950/60 rounded-[24px]" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-radial-gradient from-fuchsia-500/10 to-transparent pointer-events-none" />
            <div className="absolute inset-2 border border-white/5 rounded-[18px] flex flex-col items-center justify-center p-5 space-y-3 opacity-30">
              {activeSet?.logo ? (
                <div className="relative w-full h-20 drop-shadow-lg opacity-40">
                  <Image src={activeSet.logo} alt="" fill className="object-contain" priority />
                </div>
              ) : (
                <span className="text-white/40 font-bold text-xl tracking-widest uppercase rotate-[-90deg]">Booster</span>
              )}
            </div>
          </>
        )}

        {/* Dynamic Set Symbol Logo (Floating top right) */}
        {activeSet?.symbol && (
          <div className="absolute top-3 right-3 w-6 h-6 opacity-35 bg-zinc-950/80 p-1 rounded-lg backdrop-blur-xs z-10 border border-zinc-800/50">
            <Image src={activeSet.symbol} alt="" fill className="object-contain" />
          </div>
        )}

        {/* Dynamic PokéCast Logo (Yellow/White bold letters with heavy blue shadow border) */}
        <div className="absolute top-5 left-0 right-0 flex justify-center z-20 select-none pointer-events-none">
          <span className="text-3xl tracking-tight font-extrabold flex items-center leading-none select-none">
            <span className="text-yellow-400 font-extrabold uppercase" style={{ 
              textShadow: "-2.5px -2.5px 0 #1d4ed8, 2.5px -2.5px 0 #1d4ed8, -2.5px 2.5px 0 #1d4ed8, 2.5px 2.5px 0 #1d4ed8, -3.5px 0 0 #1d4ed8, 3.5px 0 0 #1d4ed8, 0 3.5px 0 #1d4ed8, 0 -3.5px 0 #1d4ed8, 2px 2px 4px rgba(0,0,0,0.8)" 
            }}>Poké</span>
            <span className="text-white font-extrabold uppercase" style={{ 
              textShadow: "-2.5px -2.5px 0 #1d4ed8, 2.5px -2.5px 0 #1d4ed8, -2.5px 2.5px 0 #1d4ed8, 2.5px 2.5px 0 #1d4ed8, -3.5px 0 0 #1d4ed8, 3.5px 0 0 #1d4ed8, 0 3.5px 0 #1d4ed8, 0 -3.5px 0 #1d4ed8, 2px 2px 4px rgba(0,0,0,0.8)" 
            }}>Cast</span>
          </span>
        </div>

        {/* Dynamic Set Titles (Overlayed near the bottom) */}
        <div className="absolute bottom-11 left-3 right-3 flex flex-col items-center justify-center z-20 text-center select-none pointer-events-none">
          {activeSet?.series && (
            <span className="text-[8px] font-mono tracking-widest text-amber-300 font-bold uppercase drop-shadow-md bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800/40 mb-1.5">
              {activeSet.series}
            </span>
          )}
          
          <div className="relative w-full bg-gradient-to-r from-transparent via-zinc-950/90 to-transparent border-y border-zinc-800/40 py-1.5 backdrop-blur-xs flex items-center justify-center">
            <span className="text-xs font-black tracking-widest text-white uppercase text-center drop-shadow-lg leading-tight px-3">
              {activeSet?.name || "Booster Pack"}
            </span>
          </div>
        </div>

        {/* Standard Red Game Cards Footer Banner */}
        <div className="absolute bottom-0 left-0 right-0 h-7 bg-rose-600/90 border-t border-rose-500/35 flex items-center justify-center z-25 select-none pointer-events-none">
          <span className="text-[8px] font-mono font-bold tracking-widest text-white uppercase flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-white text-rose-600 text-[9px] font-black text-center leading-4 shadow-sm">5</span>
            ADDITIONAL GAME CARDS
          </span>
        </div>

        {/* Pack count badge */}
        {packCount > 1 && (
          <div className="absolute -top-2 -right-2 w-7 h-7 bg-fuchsia-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg shadow-fuchsia-500/40 z-30">
            ×{packCount}
          </div>
        )}
      </motion.div>

      {/* Pack Count Selector */}
      {maxPacks > 1 && (
        <div className="flex items-center gap-4 mb-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-5 py-3">
          <button
            onClick={() => adjustCount(-1)}
            disabled={packCount <= 1}
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700 transition-colors active:scale-95"
          >
            <Minus className="w-3.5 h-3.5 text-zinc-300" />
          </button>
          
          <div className="flex flex-col items-center min-w-[72px]">
            <span className="text-lg font-black text-white font-mono">{packCount} Pack{packCount > 1 ? 's' : ''}</span>
            <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
              {(packCount * 5)} cards · {(packCount * 0.000001).toFixed(6)} ETH
            </span>
          </div>

          <button
            onClick={() => adjustCount(1)}
            disabled={packCount >= maxPacks}
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700 transition-colors active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-300" />
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/25 px-4 py-2.5 rounded-xl mb-4 text-center w-full max-w-[280px]">
          {error}
        </div>
      )}

      <Button 
        size="lg" 
        className="w-full max-w-[280px] rounded-full h-14 font-bold text-lg" 
        onClick={openPack}
        disabled={loading || !selectedSetId || totalAvailable === 0}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : totalAvailable === 0 ? (
          "No Packs Available"
        ) : (
          `Rip Open${packCount > 1 ? ` ${packCount} Packs` : ''}!`
        )}
      </Button>
    </div>
  );
}

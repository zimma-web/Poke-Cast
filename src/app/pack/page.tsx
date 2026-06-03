"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { Loader2, Share2, Sparkles, Minus, Plus } from "lucide-react";
import sdk from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  const referralCode = useCollectionStore(state => state.referralCode);
  
  const activeSet = sets.find(s => s.id === selectedSetId);

  // Determine dynamic gradient and glow based on set name/id
  const getSetTheme = (setName: string = "") => {
    const name = setName.toLowerCase();
    if (name.includes("flames") || name.includes("fire") || name.includes("charizard") || name.includes("triumphant")) {
      return {
        bg: "from-zinc-950 via-red-950/40 to-zinc-950",
        border: "border-red-500/30 hover:border-red-400/50",
        glow: "shadow-[0_0_40px_rgba(239,68,68,0.2)]",
        radial: "from-red-500/20 to-transparent",
        beam: "from-red-500/5 via-orange-500/5 to-transparent",
        accent: "text-red-400"
      };
    } else if (name.includes("primal") || name.includes("clash") || name.includes("storm") || name.includes("blue") || name.includes("water")) {
      return {
        bg: "from-zinc-950 via-blue-950/40 to-zinc-950",
        border: "border-blue-500/30 hover:border-blue-400/50",
        glow: "shadow-[0_0_40px_rgba(59,130,246,0.2)]",
        radial: "from-blue-500/20 to-transparent",
        beam: "from-blue-500/5 via-cyan-500/5 to-transparent",
        accent: "text-blue-400"
      };
    } else if (name.includes("yellow") || name.includes("volt") || name.includes("thunder") || name.includes("lightning") || name.includes("spark")) {
      return {
        bg: "from-zinc-950 via-amber-950/40 to-zinc-950",
        border: "border-amber-500/30 hover:border-amber-400/50",
        glow: "shadow-[0_0_40px_rgba(245,158,11,0.2)]",
        radial: "from-amber-500/20 to-transparent",
        beam: "from-amber-500/5 via-yellow-500/5 to-transparent",
        accent: "text-amber-400"
      };
    }
    // Default: PokéCast Signature Purple/Fuchsia
    return {
      bg: "from-zinc-950 via-fuchsia-950/30 to-zinc-950",
      border: "border-fuchsia-500/30 hover:border-fuchsia-400/50",
      glow: "shadow-[0_0_40px_rgba(168,85,247,0.25)]",
      radial: "from-fuchsia-500/20 to-transparent",
      beam: "from-fuchsia-500/5 via-pink-500/5 to-transparent",
      accent: "text-fuchsia-400"
    };
  };

  const theme = getSetTheme(activeSet?.name);

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
    const TREASURY_ADDRESS = '0xe251A3a0D23859157ef8041394279f7Ba46C90e3';
    const FEE_PER_PACK_WEI = BigInt(1000000000000); // 0.000001 ETH

    try {
      if (provider) {
        let senderAddress = walletAddress;
        if (!senderAddress) {
          try {
            const ethAccounts = await provider.request({ method: 'eth_accounts' }) as string[];
            if (Array.isArray(ethAccounts) && ethAccounts.length > 0) {
              senderAddress = ethAccounts[0];
            }
          } catch (e) {
            console.warn("Failed to get eth_accounts", e);
          }
        }

        if (!senderAddress) {
          throw new Error("Wallet not connected. Please open the app again.");
        }

        const totalWei = FEE_PER_PACK_WEI * BigInt(count);
        
        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: senderAddress as `0x${string}`,
            to: TREASURY_ADDRESS,
            value: `0x${totalWei.toString(16)}`,
            data: '0x',
            gas: '0x5208' // 21000 gas limit to prevent slow estimation hangs
          }]
        });
        txHash = tx as string;
        
        // Wait for the wallet confirmation UI to fully close before making the server request.
        await new Promise(resolve => setTimeout(resolve, 3500));
      } else {
        // Mock fallback for dev environments outside Farcaster
        console.warn("Wallet provider not found. Simulating transaction.");
        await new Promise(r => setTimeout(r, 800));
        txHash = "0xmock" + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      }

      // Open all packs in one request
      const res = await fetch("/api/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, setId: selectedSetId, txHash, count }),
        cache: "no-store"
      });
      let data: any;
      try {
        data = await res.json();
      } catch (err) {
        const text = await res.text();
        console.error("Invalid pack response:", text);
        setError("Failed to process pack opening. Please try again.");
        return;
      }
      
      if (!res.ok || data.error) {
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
      setError(e.message || "Failed to open pack");
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
    const referralLink = referralCode ? `https://poke-cast.vercel.app/?ref=${encodeURIComponent(referralCode)}` : 'https://poke-cast.vercel.app';
    const text = `I just pulled ${card.name} (${card.rarity || 'Common'}) on PokéCast! Join me and earn extra tickets when you sign up with my referral link: ${referralLink}`;
    try {
      if (sdk && typeof sdk.actions.openUrl === 'function') {
        sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(referralLink)}`);
      } else {
        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(referralLink)}`, '_blank');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Card reveal screen ─────────────────────────────────────────────────────
  if (opened) {
    const currentCard = cards?.[currentIndex];

    // Safety fallback if cards are somehow empty
    if (!currentCard) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-zinc-950 px-4 text-center">
          <p className="text-zinc-400 text-sm mb-4">Something went wrong loading your cards.</p>
          <Button size="lg" className="rounded-full h-14 font-bold px-8" onClick={() => { setOpened(false); setCards([]); }}>
            Go Back
          </Button>
        </div>
      );
    }

    const packNumber = Math.floor(currentIndex / 5) + 1;
    const cardInPack = (currentIndex % 5) + 1;
    const totalPacks = Math.ceil(cards.length / 5);

    return (
      <ErrorBoundary>
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

          <div className="flex-1 flex items-center justify-center relative">
            <div
              key={currentIndex}
              className="relative w-full max-w-[320px] aspect-[2.5/3.5] cursor-pointer"
              onClick={nextCard}
            >
              {currentCard.smallImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={currentCard.smallImage} 
                  alt={currentCard.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 rounded-2xl flex items-center justify-center">
                  <span className="text-zinc-500">Image Missing</span>
                </div>
              )}
            </div>
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
      </ErrorBoundary>
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
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-64px)] overflow-y-auto pt-4 pb-8 px-4 custom-scrollbar">
      {/* Economy Header */}
      <div className="flex items-center justify-between w-full max-w-[280px] px-4 py-2.5 mb-3 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
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
      <div className="w-full max-w-[280px] mb-3 relative z-50">
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
        className="relative w-full max-w-[210px] mb-3 group"
      >
        <div
          onClick={openPack}
          className={`relative w-full flex flex-col items-center justify-between cursor-pointer aspect-[2.5/3.5] bg-gradient-to-b ${theme.bg} border-2 ${theme.border} rounded-[24px] ${theme.glow} overflow-hidden transition-all duration-300`}
        >
          {/* Dynamic theme background gradients */}
          <div className={`absolute inset-0 bg-radial-gradient ${theme.radial} pointer-events-none`} />
          <div className={`absolute inset-0 bg-gradient-to-tr ${theme.beam} pointer-events-none`} />

          {/* Glassmorphic/foil shimmer sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

          {/* Premium double border */}
          <div className="absolute inset-2 border border-white/10 rounded-[18px] pointer-events-none" />
          <div className="absolute inset-2.5 border border-white/5 rounded-[17px] pointer-events-none" />

          {/* Floating Set Symbol (Top Right) */}
          {activeSet?.symbol && (
            <div className="absolute top-4 right-4 w-6 h-6 opacity-60 bg-zinc-950/80 p-1.5 rounded-lg border border-white/10 backdrop-blur-xs z-20 transition-transform duration-300 group-hover:scale-105">
              <Image src={activeSet.symbol} alt="" fill className="object-contain" />
            </div>
          )}

          {/* PokéCast branding logo at top */}
          <div className="absolute top-8 left-0 right-0 h-14 flex justify-center z-20 select-none pointer-events-none px-4">
            <div className="relative w-full h-full max-w-[145px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]">
              <Image src="/Text-PokeCast.png" alt="PokéCast" fill className="object-contain" priority />
            </div>
          </div>

          {/* Main Artwork Portal in Center */}
          <div className="flex-1 flex flex-col items-center justify-center w-full px-5 pt-14 pb-8 z-10 select-none pointer-events-none">
            <div className="relative w-full aspect-video flex items-center justify-center">
              {/* Glowing magic ring behind the set logo */}
              <div className={`absolute w-28 h-28 rounded-full bg-radial-gradient ${theme.radial} blur-xl opacity-75 animate-pulse`} />
              {activeSet?.logo ? (
                <div className="relative w-full h-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-105">
                  <Image src={activeSet.logo} alt={activeSet.name} fill className="object-contain" priority />
                </div>
              ) : (
                <span className={`font-black text-xl tracking-widest uppercase ${theme.accent} drop-shadow-md`}>
                  {activeSet?.name || "BOOSTER"}
                </span>
              )}
            </div>
          </div>

          {/* Standard Red Game Cards Footer Banner */}
          <div className="w-full h-8 bg-rose-600 border-t border-rose-500/30 flex items-center justify-center z-20 select-none pointer-events-none">
            <span className="text-[8px] font-mono font-bold tracking-widest text-white uppercase flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full bg-white text-rose-600 text-[9px] font-black text-center leading-4 shadow-sm">5</span>
              ADDITIONAL GAME CARDS
            </span>
          </div>
        </div>

        {/* Pack count badge */}
        {packCount >= 1 && (
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

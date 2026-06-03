"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { Loader2, Share2, Sparkles, Minus, Plus } from "lucide-react";
import sdk from "@farcaster/frame-sdk";

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
        <div className="flex flex-col items-center flex-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Pack Tickets</span>
          <span className="text-xs font-black text-amber-400 font-mono mt-0.5">🎟️ {packTickets}</span>
        </div>
      </div>

      {/* Set Selector */}
      <div className="w-full max-w-[280px] mb-5">
        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2 text-center">
          Select Expansion Pack
        </label>
        <select
          value={selectedSetId}
          onChange={(e) => setSelectedSetId(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-full h-11 px-4 text-sm focus:outline-none focus:border-fuchsia-500 transition-colors"
        >
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name} ({getSetProgress(set.id)} / {set.totalCards})
            </option>
          ))}
        </select>
      </div>

      {/* Pack art */}
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [0, -1.5, 1.5, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        onClick={openPack}
        className="relative w-full max-w-[240px] aspect-[2.5/3.5] bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700/50 rounded-[24px] shadow-[0_0_40px_rgba(168,85,247,0.2)] flex flex-col items-center justify-center cursor-pointer mb-5 overflow-hidden"
      >
        <div className="absolute inset-0 bg-radial-gradient from-fuchsia-500/10 to-transparent pointer-events-none" />
        
        {activeSet?.symbol && (
          <div className="absolute top-3 right-3 w-7 h-7 opacity-25 bg-white/10 p-1 rounded-lg backdrop-blur-xs">
            <Image src={activeSet.symbol} alt="" fill className="object-contain" />
          </div>
        )}
        
        <div className="absolute inset-2 border border-white/10 rounded-[18px] flex flex-col items-center justify-center p-5 space-y-3">
          {activeSet?.logo ? (
            <div className="relative w-full h-20 drop-shadow-lg">
              <Image src={activeSet.logo} alt={activeSet.name} fill className="object-contain" priority />
            </div>
          ) : (
            <span className="text-white/80 font-bold text-xl tracking-widest uppercase rotate-[-90deg]">Booster</span>
          )}
          
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-950/80 px-2.5 py-1 rounded border border-zinc-800">
            5 CARDS PACK
          </div>
        </div>

        {/* Pack count badge */}
        {packCount > 1 && (
          <div className="absolute -top-2 -right-2 w-7 h-7 bg-fuchsia-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg shadow-fuchsia-500/40">
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

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card as CardType, useCollectionStore } from "@/lib/store";
import { Loader2, Share2, Sparkles, Coins } from "lucide-react";
import sdk from "@farcaster/frame-sdk";

const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';

export default function PackScreen() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  const addCards = useCollectionStore(state => state.addCards);
  const ownedCards = useCollectionStore(state => state.ownedCards);
  const userId = useCollectionStore(state => state.userId);
  const packTickets = useCollectionStore(state => state.packTickets);
  const freePacksRemaining = useCollectionStore(state => state.freePacksRemaining);
  const updateEconomy = useCollectionStore(state => state.updateEconomy);
  const usdcBalance = useCollectionStore(state => state.usdcBalance);
  const walletAddress = useCollectionStore(state => state.walletAddress);
  
  const activeSet = sets.find(s => s.id === selectedSetId);

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

  const getSetProgress = (setId: string) => {
    const prefix = `${setId}-`;
    return Object.keys(ownedCards).filter(id => id.startsWith(prefix)).length;
  };

  const openPack = async () => {
    if (!selectedSetId || !userId) return;

    if (freePacksRemaining === 0 && packTickets === 0) {
      setError("Not enough Pack Tickets or daily free packs.");
      return;
    }

    // Check ETH balance if wallet is connected and provider is available
    const provider = sdk.wallet?.ethProvider;
    if (walletAddress && provider) {
      try {
        // Ensure connected to Base Network (8453 / 0x2105)
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }]
          });
        } catch (switchErr) {
          console.warn("Switch chain failed or was ignored:", switchErr);
        }

        const hexBalance = await provider.request({
          method: 'eth_getBalance',
          params: [walletAddress as `0x${string}`, 'latest']
        }) as string;
        const balanceWei = BigInt(hexBalance);
        const balanceETH = Number(balanceWei) / 1e18;
        if (balanceETH < 0.000001) {
          setError(`Insufficient ETH balance. Pack opening fee is 0.000001 ETH (~$0.003), but you only have ${balanceETH.toFixed(8)} ETH.`);
          return;
        }
      } catch (err) {
        console.error("Failed to check ETH balance:", err);
      }
    }

    setLoading(true);
    setError("");
    let txHash = "";

    try {
      if (provider) {
        // Ensure connected to Base Network (8453 / 0x2105)
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }]
          });
        } catch (switchErr) {
          console.warn("Switch chain failed or was ignored:", switchErr);
        }

        // 0.000001 ETH is 10^12 Wei
        const valueWei = BigInt(1000000000000);

        // Prompt native Warpcast transaction signing
        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            to: TREASURY_ADDRESS,
            value: `0x${valueWei.toString(16)}`,
            data: '0x'
          }]
        });
        txHash = tx as string;
      } else {
        // MOCK Fallback for Developer Shells & local developer environments
        console.warn("Warpcast wallet provider not found. Simulating transaction on Base.");
        await new Promise(r => setTimeout(r, 1500));
        txHash = "0xmock" + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      }

      // Submit payment hash to backend API to deduct resources and pull cards
      const res = await fetch("/api/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, setId: selectedSetId, txHash })
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
    const url = "https://pokecast.vercel.app"; // Replace with actual URL
    
    // Using Farcaster Frame SDK to open cast intent if available
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

  if (!opened) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
        {/* User Balance Economy Header */}
        <div className="flex items-center justify-between w-full max-w-[280px] px-4 py-2.5 mb-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
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

        {/* Set Selector Dropdown */}
        <div className="w-full max-w-[280px] mb-6">
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

        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, -2, 2, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          onClick={openPack}
          className="relative w-full max-w-[280px] aspect-[2.5/3.5] bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700/50 rounded-[24px] shadow-[0_0_40px_rgba(168,85,247,0.2)] flex flex-col items-center justify-center cursor-pointer mb-8 overflow-hidden"
        >
          <div className="absolute inset-0 bg-radial-gradient from-fuchsia-500/10 to-transparent pointer-events-none" />
          
          {/* Subtle background symbol if available */}
          {activeSet?.symbol && (
            <div className="absolute top-4 right-4 w-8 h-8 opacity-25 bg-white/10 p-1 rounded-lg backdrop-blur-xs">
              <Image src={activeSet.symbol} alt="" fill className="object-contain" />
            </div>
          )}
          
          <div className="absolute inset-2 border border-white/10 rounded-[18px] flex flex-col items-center justify-center p-6 space-y-4">
            {activeSet?.logo ? (
              <div className="relative w-full h-24 drop-shadow-lg">
                <Image src={activeSet.logo} alt={activeSet.name} fill className="object-contain" priority />
              </div>
            ) : (
              <span className="text-white/80 font-bold text-2xl tracking-widest uppercase rotate-[-90deg]">Booster</span>
            )}
            
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-950/80 px-2.5 py-1 rounded border border-zinc-800">
              5 CARDS PACK
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/25 px-4 py-2.5 rounded-xl mb-4 text-center w-full max-w-[280px]">
            {error}
          </div>
        )}

        <Button 
          size="lg" 
          className="w-full max-w-[280px] rounded-full h-14 font-bold text-lg" 
          onClick={openPack}
          disabled={loading || !selectedSetId || (freePacksRemaining === 0 && packTickets === 0)}
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (freePacksRemaining === 0 && packTickets === 0) ? (
            "Not enough Pack Tickets"
          ) : (
            "Rip Open!"
          )}
        </Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-zinc-950 px-4 pt-8">
      <div className="flex justify-between items-center mb-6 text-zinc-400 text-sm font-medium">
        <span>Card {currentIndex + 1} / {cards.length}</span>
        <span className="flex items-center text-amber-400">
          <Sparkles className="w-4 h-4 mr-1" />
          {currentCard.rarity || 'Common'}
        </span>
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
            
            {/* Holographic foil effect overlay for rare cards */}
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
          <Button size="lg" className="flex-1 rounded-full h-14 font-bold" onClick={() => setOpened(false)}>
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

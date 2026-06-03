"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCollectionStore } from "@/lib/store";
import { Loader2, Ticket, ChevronLeft, CreditCard, Sparkles, CheckCircle2 } from "lucide-react";
import sdk from "@farcaster/miniapp-sdk";
import Image from "next/image";
import { useSendTransaction, useAccount } from "wagmi";

const TREASURY_ADDRESS = '0xe251A3a0D23859157ef8041394279f7Ba46C90e3';
const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function TopUpPage() {
  const { sendTransactionAsync } = useSendTransaction();
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const userId = useCollectionStore(state => state.userId);
  const packTickets = useCollectionStore(state => state.packTickets);
  const walletAddress = useCollectionStore(state => state.walletAddress);
  const updateEconomy = useCollectionStore(state => state.updateEconomy);

  const [usdAmount, setUsdAmount] = useState<number>(1); // minimum $1
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(3000);

  // Fetch ETH price to show equivalent amount
  useEffect(() => {
    fetch("https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD")
      .then(res => res.json())
      .then(data => {
        if (data.USD) {
          setEthPrice(data.USD);
        }
      })
      .catch(err => console.error("Failed to fetch ETH price:", err));
  }, []);

  const ethAmount = (usdAmount / ethPrice).toFixed(6);
  const ticketAmount = usdAmount * 10;
  const pointsAwarded = usdAmount * 50;

  const handlePurchase = async () => {
    if (!userId) {
      setError("Please log in first.");
      return;
    }

    setLoading(true);
    setError("");

    let txHash = "";
    const senderAddress = address || walletAddress || "";

    try {
      if (isConnected) {
        if (paymentMethod === 'usdc') {
          // Send USDC transfer transaction for usdAmount
          // transfer(address,uint255) selector: 0xa9059cbb
          const toAddressPadded = TREASURY_ADDRESS.toLowerCase().replace('0x', '').padStart(64, '0');
          // 1 USDC = 1,000,000 units (6 decimals)
          const totalUnits = usdAmount * 1000000;
          const amountPadded = totalUnits.toString(16).padStart(64, '0');
          const data = `0xa9059cbb${toAddressPadded}${amountPadded}`;

          const tx = await sendTransactionAsync({
            to: USDC_CONTRACT_BASE,
            value: BigInt(0),
            data: data as `0x${string}`
          });
          txHash = tx;
        } else {
          // Send equivalent ETH transaction
          const ethInWei = BigInt(Math.floor((usdAmount / ethPrice) * 1e18));
          const tx = await sendTransactionAsync({
            to: TREASURY_ADDRESS as `0x${string}`,
            value: ethInWei,
          });
          txHash = tx;
        }
      } else {
        // Mock fallback for local dev env
        console.warn("Wagmi wallet not connected. Simulating top-up transaction.");
        await new Promise(r => setTimeout(r, 1200));
        txHash = "0xmock_topup_" + Array.from({ length: 50 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      }

      // Verify on backend
      const res = await fetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          txHash,
          method: paymentMethod,
          userAddress: senderAddress,
          usdAmount
        })
      });

      const data = await res.json();
      if (res.status === 400 || data.error) {
        throw new Error(data.error || "Failed to process purchase transaction");
      }

      // Sync state with updated tickets
      if (data.newBalance !== undefined) {
        updateEconomy({
          packTickets: data.newBalance,
          freePacksRemaining: useCollectionStore.getState().freePacksRemaining || 0,
          lastDailyReset: useCollectionStore.getState().lastDailyReset
        });
      }

      setSuccess(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Purchase failed (transaction rejected or timed out)");
    } finally {
      setLoading(false);
    }
  };

  const adjustUsdAmount = (delta: number) => {
    setUsdAmount(prev => Math.max(1, prev + delta));
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 text-center bg-zinc-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 p-8 rounded-3xl flex flex-col items-center space-y-4 max-w-[320px] shadow-[0_0_30px_rgba(16,185,129,0.15)]"
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-400 stroke-[2.5]" />
          <h2 className="text-xl font-black text-white">Purchase Successful!</h2>
          <p className="text-sm text-zinc-400">
            {ticketAmount} Pack Tickets have been added to your account.
          </p>
          <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 text-amber-400 font-mono text-sm font-black flex items-center gap-1.5 mt-2">
            <Ticket className="w-4 h-4 fill-amber-400/20" />
            Balance: {packTickets} Tickets
          </div>
          <div className="text-[10px] text-fuchsia-400 font-mono flex items-center gap-1 mt-1">
            <Sparkles className="w-3 h-3" />
            +{pointsAwarded} PokePoints Awarded!
          </div>

          <Button 
            className="w-full rounded-full h-11 font-bold mt-4" 
            onClick={() => router.push("/pack")}
          >
            Go Rip Packs!
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-zinc-950 text-white px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-300" />
        </button>
        <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Top Up Tickets
        </h1>
        <div className="bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800/80 text-amber-400 font-mono text-xs font-black flex items-center gap-1">
          <Ticket className="w-3.5 h-3.5 fill-amber-400/20" />
          {packTickets}
        </div>
      </div>

      {/* Package Selection Display */}
      <div className="space-y-4 mb-5">
        {/* Quick Packages Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { usd: 1, tickets: 10, pts: 50, label: "Starter" },
            { usd: 2, tickets: 20, pts: 100, label: "Popular" },
            { usd: 5, tickets: 50, pts: 250, label: "Collector" },
            { usd: 10, tickets: 100, pts: 500, label: "Legendary" }
          ].map((pkg) => {
            const isSelected = usdAmount === pkg.usd;
            return (
              <button
                key={pkg.usd}
                onClick={() => setUsdAmount(pkg.usd)}
                className={`relative overflow-hidden p-4 rounded-2xl border text-left transition-all duration-200 ${
                  isSelected
                    ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                    : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-850"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />
                )}
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-0.5">{pkg.label}</div>
                <div className="text-lg font-black text-white font-mono">{pkg.tickets} Tickets</div>
                <div className="text-xs text-amber-400 font-bold font-mono mt-1">${pkg.usd}.00 USD</div>
                <div className="text-[9px] text-fuchsia-400 font-mono mt-0.5">+{pkg.pts} pts</div>
              </button>
            );
          })}
        </div>

        {/* Custom Multiplier Selector */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Custom Ticket Multiplier</span>
          
          <div className="flex items-center gap-5">
            <button
              onClick={() => adjustUsdAmount(-1)}
              disabled={usdAmount <= 1}
              className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700 transition-colors active:scale-95"
            >
              <span className="text-lg font-bold text-zinc-300">-</span>
            </button>
            
            <div className="flex flex-col items-center min-w-[100px]">
              <span className="text-2xl font-black text-white font-mono">${usdAmount}.00</span>
              <span className="text-[10px] font-mono text-zinc-500 mt-0.5">{ticketAmount} Tickets</span>
            </div>

            <button
              onClick={() => adjustUsdAmount(1)}
              className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center hover:bg-zinc-700 transition-colors active:scale-95"
            >
              <span className="text-lg font-bold text-zinc-300">+</span>
            </button>
          </div>
          
          <div className="text-[9px] font-mono text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <Sparkles className="w-2.5 h-2.5" />
            Includes +{pointsAwarded} PokePoints
          </div>
        </div>
      </div>

      {/* Payment Method Tabs */}
      <div className="mb-5 space-y-2.5">
        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 px-1">
          Select Payment Token
        </label>
        
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 border border-zinc-850 rounded-2xl">
          <button
            onClick={() => setPaymentMethod('usdc')}
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              paymentMethod === 'usdc'
                ? "bg-zinc-900 border border-zinc-800 text-white shadow-md"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className="relative w-4 h-4 rounded-full bg-[#2775CA] flex items-center justify-center text-white text-[9px] font-bold">
              $
            </div>
            <span>Base USDC</span>
          </button>
          
          <button
            onClick={() => setPaymentMethod('eth')}
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              paymentMethod === 'eth'
                ? "bg-zinc-900 border border-zinc-800 text-white shadow-md"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className="relative w-4 h-4 rounded-full bg-[#627EEA] flex items-center justify-center text-white text-[8px] font-bold">
              Ξ
            </div>
            <span>Base ETH</span>
          </button>
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 mb-5 space-y-3 font-mono text-xs text-zinc-400">
        <div className="flex justify-between">
          <span>Tickets Purchased</span>
          <span className="font-bold text-white">{ticketAmount} Pack Tickets</span>
        </div>
        <div className="flex justify-between">
          <span>Network / Blockchain</span>
          <span className="font-bold text-white flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Base Chain
          </span>
        </div>
        <div className="h-[1px] bg-zinc-900" />
        <div className="flex justify-between items-center pt-1">
          <span className="text-zinc-300 font-bold">Total Amount Due</span>
          <span className="text-sm font-black text-white font-mono">
            {paymentMethod === 'usdc' ? `${usdAmount}.00 USDC` : `${ethAmount} ETH`}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/25 px-4 py-3 rounded-2xl mb-5 text-center">
          {error}
        </div>
      )}

      {/* Checkout Button */}
      <div className="mt-auto pb-8">
        <Button
          size="lg"
          onClick={handlePurchase}
          disabled={loading}
          className="w-full rounded-full h-14 font-bold text-lg shadow-lg hover:shadow-primary/10 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay {paymentMethod === 'usdc' ? `${usdAmount}.00 USDC` : `${ethAmount} ETH`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

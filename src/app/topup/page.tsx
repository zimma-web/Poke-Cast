"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCollectionStore } from "@/lib/store";
import { Loader2, Ticket, ChevronLeft, CreditCard, Sparkles, CheckCircle2 } from "lucide-react";
import sdk from "@farcaster/frame-sdk";
import Image from "next/image";

const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';
const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function TopUpPage() {
  const router = useRouter();
  const userId = useCollectionStore(state => state.userId);
  const packTickets = useCollectionStore(state => state.packTickets);
  const walletAddress = useCollectionStore(state => state.walletAddress);
  const updateEconomy = useCollectionStore(state => state.updateEconomy);

  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(3000);
  const [ethAmount, setEthAmount] = useState<string>("0.00033");

  // Fetch ETH price to show equivalent amount
  useEffect(() => {
    fetch("https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD")
      .then(res => res.json())
      .then(data => {
        if (data.USD) {
          setEthPrice(data.USD);
          const calculated = (1 / data.USD).toFixed(6);
          setEthAmount(calculated);
        }
      })
      .catch(err => console.error("Failed to fetch ETH price:", err));
  }, []);

  const handlePurchase = async () => {
    if (!userId) {
      setError("Please log in first.");
      return;
    }

    setLoading(true);
    setError("");

    const provider = sdk.wallet?.ethProvider;
    let txHash = "";

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
          throw new Error("Wallet not connected. Please open the app inside Farcaster again.");
        }

        if (paymentMethod === 'usdc') {
          // Send 1.00 USDC transfer transaction
          // transfer(address,uint256) selector: 0xa9059cbb
          const toAddressPadded = TREASURY_ADDRESS.toLowerCase().replace('0x', '').padStart(64, '0');
          // 1 USDC = 1,000,000 units (6 decimals) = 0xf4240 in hex
          const amountPadded = (1000000).toString(16).padStart(64, '0');
          const data = `0xa9059cbb${toAddressPadded}${amountPadded}`;

          const tx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
              from: senderAddress as `0x${string}`,
              to: USDC_CONTRACT_BASE,
              value: '0x0',
              data: data as `0x${string}`
            }]
          });
          txHash = tx as string;
        } else {
          // Send equivalent ETH transaction
          const ethInWei = BigInt(Math.floor((1 / ethPrice) * 1e18));
          const gasHex = `0x${(21000).toString(16)}` as `0x${string}`;

          const tx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
              from: senderAddress as `0x${string}`,
              to: TREASURY_ADDRESS,
              value: `0x${ethInWei.toString(16)}`,
              gas: gasHex,
              data: '0x'
            }]
          });
          txHash = tx as string;
        }
      } else {
        // Mock fallback for local dev env
        console.warn("Wallet provider not found. Simulating top-up transaction.");
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
          userAddress: senderAddress
        })
      });

      const data = await res.json();
      if (res.status === 400 || data.error) {
        throw new Error(data.error || "Failed to process purchase transaction");
      }

      // Sync state with updated tickets and points
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
            10 Pack Tickets have been added to your account.
          </p>
          <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 text-amber-400 font-mono text-sm font-black flex items-center gap-1.5 mt-2">
            <Ticket className="w-4 h-4 fill-amber-400/20" />
            Balance: {packTickets} Tickets
          </div>
          <div className="text-[10px] text-fuchsia-400 font-mono flex items-center gap-1 mt-1">
            <Sparkles className="w-3 h-3" />
            +50 PokePoints Awarded!
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
      <div className="flex items-center justify-between mb-6">
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

      {/* Product Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 mb-6 shadow-xl flex flex-col items-center text-center"
      >
        <div className="absolute inset-0 bg-radial-gradient from-amber-500/10 to-transparent pointer-events-none" />
        
        {/* Ticket stack mock icon */}
        <div className="relative w-20 h-20 mb-4 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <Ticket className="w-10 h-10 text-amber-400 fill-amber-400/20 rotate-[-12deg]" />
          <Ticket className="w-8 h-8 text-amber-400 fill-amber-400/10 absolute rotate-[15deg] translate-x-3 translate-y-1" />
        </div>

        <h2 className="text-2xl font-black text-white">Ticket Pack</h2>
        <p className="text-zinc-500 text-xs mt-1 mb-4">Get 10 Pack Tickets to open booster packs instantly!</p>
        
        <div className="flex items-baseline space-x-1 mb-2">
          <span className="text-3xl font-black text-white font-mono">$1.00</span>
          <span className="text-zinc-500 text-xs font-mono">USD</span>
        </div>
        
        <div className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          BONUS: +50 PokePoints
        </div>
      </motion.div>

      {/* Payment Method Tabs */}
      <div className="mb-6 space-y-2.5">
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
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 mb-6 space-y-3 font-mono text-xs text-zinc-400">
        <div className="flex justify-between">
          <span>Tickets Purchased</span>
          <span className="font-bold text-white">10 Pack Tickets</span>
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
            {paymentMethod === 'usdc' ? "1.00 USDC" : `${ethAmount} ETH`}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/25 px-4 py-3 rounded-2xl mb-6 text-center">
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
              Pay {paymentMethod === 'usdc' ? "1.00 USDC" : `${ethAmount} ETH`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

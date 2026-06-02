"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Plus, Search, X, Star, ChevronRight,
  Clock, ArrowLeftRight, CheckCircle, XCircle,
  AlertTriangle, Loader2, Flag, Package, Wallet,
  ExternalLink, Coins, Calendar, Check, AlertCircle
} from "lucide-react";
import { useCollectionStore } from "@/lib/store";
import sdk from "@farcaster/frame-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CardMeta { id: string; name: string; smallImage?: string; largeImage?: string; rarity?: string; setId?: string; }
interface Auction {
  id: string;
  seller: { id: string; username: string; avatar: string; fid: number; wallet_address: string };
  winner?: { id: string; username: string; avatar: string; wallet_address: string };
  card: CardMeta;
  card_id: string;
  user_card_id: string;
  start_price: number;
  buyout_price: number | null;
  highest_bid: number;
  highest_bidder_id: string | null;
  status: "active" | "pending_payment" | "completed" | "cancelled" | "expired";
  end_at: string;
  created_at: string;
  tx_hash?: string;
  wishlistMatch?: boolean;
}
interface BidHistory {
  id: string;
  bidder: { id: string; username: string; avatar: string };
  amount: number;
  created_at: string;
}
type View = "feed" | "my_listings" | "my_bids";

// ─── Constants ────────────────────────────────────────────────────────────────
const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';
const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CardThumb({ card, size = 48 }: { card: CardMeta; size?: number }) {
  const [err, setErr] = useState(false);
  const src = card.smallImage || card.largeImage || "";
  return (
    <div style={{ width: size, height: size * 1.4 }} className="rounded-lg overflow-hidden bg-zinc-800 shrink-0 relative border border-zinc-700/50">
      {src && !err ? (
        <Image src={src} alt={card.name} fill className="object-contain" onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500 font-mono p-1 text-center leading-tight">{card.name}</div>
      )}
    </div>
  );
}

function StatusBadge({ status, isHighestBidder }: { status: string; isHighestBidder?: boolean }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    completed: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    cancelled: "bg-zinc-700/50 text-zinc-400 border-zinc-700",
    expired: "bg-zinc-700/50 text-zinc-500 border-zinc-700",
    pending_payment: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  };

  let label = status.replace('_', ' ');
  if (status === 'pending_payment') {
    label = isHighestBidder ? 'claim payment' : 'pending payment';
  }

  return (
    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status] || map.active}`}>
      {label}
    </span>
  );
}

// Format short wallet address
function formatAddr(addr?: string | null) {
  if (!addr) return "Not connected";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(endAt: string) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsEnded(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const hStr = h.toString().padStart(2, "0");
      const mStr = m.toString().padStart(2, "0");
      const sStr = s.toString().padStart(2, "0");

      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
      setIsEnded(false);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  return { timeLeft, isEnded };
}

// ─── Toast Alert Component ────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err" | "info"; onClose: () => void }) {
  const c = { 
    ok: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", 
    err: "bg-rose-500/15 border-rose-500/30 text-rose-300", 
    info: "bg-sky-500/15 border-sky-500/30 text-sky-300" 
  };
  return (
    <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 z-[999] flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-sm mx-auto ${c[type]}`}>
      {type === "ok" && <CheckCircle className="w-4 h-4 shrink-0" />}
      {type === "err" && <XCircle className="w-4 h-4 shrink-0" />}
      {type === "info" && <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="text-sm font-medium flex-1 leading-snug">{msg}</span>
      <button onClick={onClose}><X className="w-4 h-4 opacity-60" /></button>
    </motion.div>
  );
}

// ─── Card Picker Component ────────────────────────────────────────────────────
function CardPicker({ title, ownedCards = {}, selectedId, onSelect, onClose }: {
  title: string; ownedCards?: Record<string, number>;
  selectedId: string | null; onSelect: (card: CardMeta) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [allOwnedCards, setAllOwnedCards] = useState<CardMeta[]>([]);
  const [cards, setCards] = useState<CardMeta[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all owned cards once on mount
  useEffect(() => {
    const loadOwnedCards = async () => {
      setLoading(true);
      try {
        const ownedIds = Object.keys(ownedCards).filter(id => ownedCards[id] > 0);
        if (ownedIds.length === 0) {
          setAllOwnedCards([]);
          setCards([]);
          return;
        }
        const url = `/api/cards?ids=${encodeURIComponent(ownedIds.join(','))}`;
        const res = await fetch(url);
        const data = await res.json();
        const result = data.cards || [];
        setAllOwnedCards(result);
        setCards(result);
      } catch (err) {
        console.error("Failed to load owned cards:", err);
      } finally {
        setLoading(false);
      }
    };
    loadOwnedCards();
  }, [ownedCards]);

  // Filter cards locally when search query changes
  useEffect(() => {
    if (!q.trim()) {
      setCards(allOwnedCards);
      return;
    }
    const lowerQ = q.toLowerCase();
    const filtered = allOwnedCards.filter(c => c.name.toLowerCase().includes(lowerQ));
    setCards(filtered);
  }, [q, allOwnedCards]);

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950/95 flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-zinc-100 flex-1">{title}</h3>
      </div>
      <div className="px-4 py-2 border-b border-zinc-800/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search owned cards…"
            className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
        {loading && <div className="col-span-3 py-12 flex justify-center"><Loader2 className="w-6 h-6 text-fuchsia-500 animate-spin" /></div>}
        {!loading && cards.map(card => {
          const isSelected = selectedId === card.id;
          return (
            <button key={card.id} onClick={() => onSelect(card)}
              className={`relative flex flex-col items-center rounded-2xl p-2 border transition-all ${isSelected ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-zinc-800/60 bg-zinc-900/60 active:scale-95"}`}>
              <CardThumb card={card} size={60} />
              <p className="text-[9px] text-zinc-300 mt-1 text-center leading-tight line-clamp-2">{card.name}</p>
              {ownedCards[card.id] > 0 && (
                <span className="text-[8px] font-bold text-amber-400 mt-0.5">×{ownedCards[card.id]}</span>
              )}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
        {!loading && cards.length === 0 && (
          <div className="col-span-3 py-12 text-center text-zinc-600 text-sm">No owned cards found</div>
        )}
      </div>
      <div className="p-4 border-t border-zinc-800">
        <button onClick={() => { const selected = cards.find(c => c.id === selectedId); if (selected) onSelect(selected); }} disabled={!selectedId}
          className="w-full h-12 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all">
          Confirm Selection
        </button>
      </div>
    </div>
  );
}

// ─── Create Listing Sheet Component ───────────────────────────────────────────
function CreateListingSheet({ userId, ownedCards, onCreated, onClose }: {
  userId: string; ownedCards: Record<string, number>; onCreated: () => void; onClose: () => void;
}) {
  const [selectedCard, setSelectedCard] = useState<CardMeta | null>(null);
  const [startPrice, setStartPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [duration, setDuration] = useState("24"); // default 24 hours
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "info" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async () => {
    if (!selectedCard || !startPrice) return;
    setSubmitting(true);
    setStatusText("Preparing listing...");
    try {
      const parsedBuyout = buyoutPrice ? parseFloat(buyoutPrice) : null;
      let listingTxHash = null;

      if (parsedBuyout !== null && parsedBuyout > 0) {
        setStatusText("Requesting listing fee (0.05 USD)...");
        const provider = sdk.wallet?.ethProvider;
        if (provider) {
          const valueWei = BigInt(15000000000000); // 0.000015 ETH
          try {
            const tx = await provider.request({
              method: 'eth_sendTransaction',
              params: [{
                to: TREASURY_ADDRESS,
                value: `0x${valueWei.toString(16)}`,
                gas: '0x5208',
                data: '0x'
              }]
            });
            listingTxHash = tx as string;
          } catch (walletErr: any) {
            console.error("Wallet transaction rejected:", walletErr);
            throw new Error(walletErr.message || "Listing fee payment rejected by wallet.");
          }
        } else {
          // Dev Mock
          console.warn("Frame wallet provider not found. Simulating transaction on Base.");
          await new Promise(r => setTimeout(r, 1500));
          listingTxHash = "0xmock_listing_" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        }
      }

      setStatusText("Creating auction listing...");
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_auction",
          payload: {
            userId,
            cardId: selectedCard.id,
            startPrice,
            buyoutPrice: parsedBuyout,
            durationHours: parseInt(duration),
            listingTxHash
          }
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      showToast("Auction listed successfully!", "ok");
      setTimeout(() => {
        onCreated();
      }, 1000);
    } catch (e: any) {
      showToast(e.message || "Failed to create auction", "err");
    } finally {
      setSubmitting(false);
      setStatusText("");
    }
  };

  return (
    <>
      {picker && (
        <CardPicker
          title="Select Card to Auction"
          ownedCards={ownedCards}
          selectedId={selectedCard?.id || null}
          onSelect={card => { setSelectedCard(card); setPicker(false); }}
          onClose={() => setPicker(false)}
        />
      )}

      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15 }}
        className="fixed inset-x-0 bottom-0 z-[60] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-zinc-100 flex-1">List Card for Auction</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Card Selection */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Selected Card</p>
            {!selectedCard ? (
              <button onClick={() => setPicker(true)}
                className="w-full h-24 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-sm flex items-center justify-center gap-2 hover:border-fuchsia-500/40 hover:text-zinc-500 transition-all">
                <Plus className="w-5 h-5" /> Tap to select card
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
                <CardThumb card={selectedCard} size={50} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-zinc-200 truncate">{selectedCard.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {selectedCard.id}</p>
                </div>
                <button onClick={() => setSelectedCard(null)} className="text-xs text-rose-400 font-semibold px-2.5 py-1.5 rounded-xl bg-rose-500/10 shrink-0">Remove</button>
              </div>
            )}
          </div>

          {/* Pricing fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Start Price (USDC)</p>
              <input value={startPrice} onChange={e => setStartPrice(e.target.value)} type="number" step="0.01" placeholder="e.g. 1.00"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Buyout Price (USDC)</p>
              <input value={buyoutPrice} onChange={e => setBuyoutPrice(e.target.value)} type="number" step="0.01" placeholder="Optional buyout"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
            </div>
          </div>

          {/* Duration Selector */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Auction Duration</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "1", label: "1 Hour" },
                { value: "6", label: "6 Hours" },
                { value: "12", label: "12 Hours" },
                { value: "24", label: "24 Hours" }
              ].map(opt => (
                <button key={opt.value} onClick={() => setDuration(opt.value)}
                  className={`h-10 text-xs font-semibold rounded-xl border transition-all ${duration === opt.value ? "bg-fuchsia-600 border-fuchsia-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button onClick={handleSubmit} disabled={submitting || !selectedCard || !startPrice}
            className="w-full h-12 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Store className="w-5 h-5" />}
            {submitting ? (statusText || "Posting Auction…") : "Start Auction"}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}

// ─── Auction Card Component ───────────────────────────────────────────────────
function AuctionCard({ auction, onTap, isOwnListing }: { auction: Auction; onTap: () => void; isOwnListing: boolean }) {
  const { timeLeft } = useCountdown(auction.end_at);
  const highestBid = auction.highest_bid > 0 ? auction.highest_bid : auction.start_price;

  return (
    <motion.button
      onClick={onTap} whileTap={{ scale: 0.98 }}
      className={`w-full text-left bg-zinc-900/60 border rounded-2xl p-3.5 space-y-3 transition-all active:scale-[0.98] ${auction.wishlistMatch ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.07)]" : "border-zinc-800/60"}`}>
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/30">
          {auction.seller.avatar
            ? <img src={auction.seller.avatar} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-bold">{auction.seller.username?.[0]?.toUpperCase()}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-zinc-200">{auction.seller.username}</span>
            {auction.wishlistMatch && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5" /> Wishlist Match
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5 font-mono">
            <Clock className="w-3 h-3" /> {timeLeft} left
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
      </div>

      {/* Main card panel */}
      <div className="flex gap-3 bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-2.5">
        <CardThumb card={auction.card} size={50} />
        <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
          <div>
            <h4 className="text-sm font-bold text-zinc-200 truncate">{auction.card.name}</h4>
            <p className="text-[9.5px] text-zinc-500 truncate">{auction.card.rarity || 'Common'}</p>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-1">
            <div>
              <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest leading-none">Highest Bid</p>
              <p className="text-sm font-extrabold text-fuchsia-400 font-mono mt-1">
                {highestBid.toFixed(2)} <span className="text-[9.5px] font-normal text-zinc-500">USDC</span>
              </p>
            </div>
            {auction.buyout_price && (
              <div className="text-right">
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest leading-none">Buyout</p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-1">
                  {auction.buyout_price.toFixed(2)} <span className="text-[9.5px] font-normal text-zinc-500">USDC</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Auction Detail Sheet Component ───────────────────────────────────────────
function AuctionDetailSheet({ auctionId, userId, onClose, onRefresh }: {
  auctionId: string; userId: string | null; onClose: () => void; onRefresh: () => void;
}) {
  const [data, setData] = useState<{ auction: Auction; bids: BidHistory[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "info" } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);

  // Web3 Transaction Modal State
  const [txModal, setTxModal] = useState<{
    show: boolean;
    state: "confirm" | "submitting" | "broadcasting" | "verifying" | "success" | "error";
    errorMsg?: string;
    txHash?: string;
    price: number;
    walletAddress?: string;
    sellerAddress?: string;
  }>({ show: false, state: "confirm", price: 0 });

  const showToast = (msg: string, type: "ok" | "err" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_auction", payload: { auctionId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);

      // Pre-fill next valid bid
      const minBid = d.auction.highest_bid > 0 ? d.auction.highest_bid + 0.1 : d.auction.start_price;
      setBidAmount(minBid.toFixed(2));
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  }, [auctionId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = data?.auction?.seller?.id === userId;
  const highestBidVal = data?.auction ? (data.auction.highest_bid > 0 ? data.auction.highest_bid : data.auction.start_price) : 0;
  const { timeLeft, isEnded } = useCountdown(data?.auction?.end_at || new Date().toISOString());

  // Handle placing a soft commitment bid
  const handlePlaceBid = async () => {
    if (!userId || !bidAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "place_bid", payload: { auctionId, bidderId: userId, amount: bidAmount } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Bid successfully placed! 🪙");
      load();
      onRefresh();
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setSubmitting(false); }
  };

  // Triggers the Warpcast Web3 Transaction Dialog
  const triggerOnChainPayment = async () => {
    if (!data?.auction || !userId) return;
    
    // Check if Warpcast provider is available
    const provider = sdk.wallet?.ethProvider;
    const expectedUSDC = data.auction.status === 'active' ? data.auction.buyout_price! : data.auction.highest_bid;
    const sellerAddr = data.auction.seller.wallet_address;
    const buyerAddr = data.auction.winner?.wallet_address || ""; // if pending_payment, or fallback

    setTxModal({
      show: true,
      state: "confirm",
      price: expectedUSDC,
      sellerAddress: sellerAddr,
      walletAddress: buyerAddr || undefined
    });
  };

  // Executes standard ERC-20 transfer(to, value) on Base via Warpcast Client Wallet
  const executeTransaction = async () => {
    if (!data?.auction || !userId) return;
    
    setTxModal(prev => ({ ...prev, state: "submitting" }));

    const expectedUSDC = data.auction.status === 'active' ? data.auction.buyout_price! : data.auction.highest_bid;
    const recipient = data.auction.seller.wallet_address;

    try {
      const provider = sdk.wallet?.ethProvider;
      let txHash = "";
      const senderAddress = walletAddress || data.auction.winner?.wallet_address || "";

      if (provider) {
        if (!senderAddress) {
          throw new Error("Connected Farcaster wallet address is required to send USDC.");
        }

        // USDC decimals: 6
        // Split payment: 98% to seller, 2% to treasury fee
        const sellerAmount = expectedUSDC * 0.98;
        const treasuryAmount = expectedUSDC * 0.02;
        
        const valueSeller = BigInt(Math.round(sellerAmount * 1_000_000));
        const valueTreasury = BigInt(Math.round(treasuryAmount * 1_000_000));
        
        const cleanRecipient = recipient.toLowerCase().replace('0x', '');
        const cleanTreasury = TREASURY_ADDRESS.toLowerCase().replace('0x', '');
        
        // ERC-20 transfer selector: 0xa9059cbb
        const txDataSeller = ('0xa9059cbb' + 
                             cleanRecipient.padStart(64, '0') + 
                             valueSeller.toString(16).padStart(64, '0')) as `0x${string}`;
                             
        const txDataTreasury = ('0xa9059cbb' + 
                               cleanTreasury.padStart(64, '0') + 
                               valueTreasury.toString(16).padStart(64, '0')) as `0x${string}`;

        setTxModal(prev => ({ ...prev, state: "broadcasting" }));
        
        // 1. Pay seller
        const tx1 = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: senderAddress as `0x${string}`,
            to: USDC_CONTRACT_BASE,
            data: txDataSeller,
            gas: '0x11170',
            value: '0x0'
          }]
        });
        
        // 2. Pay 2% fee to treasury
        const tx2 = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: senderAddress as `0x${string}`,
            to: USDC_CONTRACT_BASE,
            data: txDataTreasury,
            gas: '0x11170',
            value: '0x0'
          }]
        });
        
        txHash = `${tx1},${tx2}`;
      } else {
        // MOCK Fallback for Frame Developer Shells / Dev Sandboxes
        console.warn("Frame wallet provider not found. Simulating transaction on Base.");
        setTxModal(prev => ({ ...prev, state: "broadcasting" }));
        await new Promise(r => setTimeout(r, 2000));
        const m1 = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        const m2 = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        txHash = `${m1},${m2}`;
      }

      setTxModal(prev => ({ ...prev, state: "verifying", txHash }));

      // Send hash to API for on-chain verification & card swap
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_payment",
          payload: { auctionId, txHash, userId }
        })
      });
      const verifyRes = await res.json();
      if (verifyRes.error) throw new Error(verifyRes.error);

      setTxModal(prev => ({ ...prev, state: "success" }));
      onRefresh();
      load();
    } catch (err: any) {
      console.error(err);
      setTxModal(prev => ({ ...prev, state: "error", errorMsg: err.message || "Transaction reverted or was rejected." }));
    }
  };

  const handleCancelAuction = async () => {
    if (!userId || !data) return;
    if (data.bids.length > 0) {
      if (!confirm("Caution: This auction already has active bids. Cancelling it will void the bids. Continue?")) return;
    } else {
      if (!confirm("Cancel this auction listing?")) return;
    }
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_auction", payload: { auctionId, userId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Auction listing cancelled");
      onRefresh(); onClose();
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const handleReport = async () => {
    if (!userId || !reportReason.trim()) return;
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report_auction", payload: { auctionId, reporterUserId: userId, reason: reportReason } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Report submitted.", "info");
      setShowReport(false); setReportReason("");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const isHighestBidder = data?.auction?.highest_bidder_id === userId;

  return (
    <>
      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>
      
      {/* ─── WEB3 TRANSACTION MODAL DIALOG ─────────────────────────────────────── */}
      <AnimatePresence>
        {txModal.show && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
              
              {txModal.state !== "success" && txModal.state !== "error" && (
                <button onClick={() => setTxModal(prev => ({ ...prev, show: false }))}
                  className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-fuchsia-500/10 text-fuchsia-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
                  <Wallet />
                </div>
                <h4 className="text-base font-bold text-zinc-100">Base On-Chain Payment</h4>
                <p className="text-xs text-zinc-500 leading-snug">USDC transaction via Farcaster custody wallet</p>
              </div>

              {/* Confirm details view */}
              {txModal.state === "confirm" && (
                <div className="space-y-4 py-2">
                  <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-2xl p-3.5 space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Payment Amount:</span>
                      <span className="text-zinc-200 font-bold">{txModal.price.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Network:</span>
                      <span className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Base Chain</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Estimated Gas:</span>
                      <span className="text-zinc-400">~$0.15 (Base gas)</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800/60 pt-2 mt-2">
                      <span className="text-zinc-500">Recipient Address:</span>
                      <span className="text-zinc-400 font-semibold">{formatAddr(txModal.sellerAddress)}</span>
                    </div>
                  </div>
                  <button onClick={executeTransaction}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg">
                    Confirm & Send Payment
                  </button>
                </div>
              )}

              {/* Progress states */}
              {(txModal.state === "submitting" || txModal.state === "broadcasting" || txModal.state === "verifying") && (
                <div className="py-8 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
                  <p className="text-sm text-zinc-200 font-semibold font-mono animate-pulse">
                    {txModal.state === "submitting" && "Requesting wallet sign..."}
                    {txModal.state === "broadcasting" && "Broadcasting to Base network..."}
                    {txModal.state === "verifying" && "Verifying on-chain transaction..."}
                  </p>
                  <p className="text-[10px] text-zinc-600 max-w-[200px] text-center leading-normal">
                    Please approve the transaction prompt inside Warpcast if requested.
                  </p>
                </div>
              )}

              {/* Success View */}
              {txModal.state === "success" && (
                <div className="space-y-4 py-2 text-center">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-lg">
                    <Check />
                  </div>
                  <h5 className="font-bold text-zinc-100">Transaction Confirmed!</h5>
                  <p className="text-xs text-zinc-400 px-4 leading-relaxed">
                    USDC transfer confirmed on Base! Card ownership has been swapped successfully.
                  </p>
                  {txModal.txHash && (
                    <a href={`https://basescan.org/tx/${txModal.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-zinc-500 hover:text-fuchsia-400 underline py-1">
                      View on BaseScan <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button onClick={() => { setTxModal(prev => ({ ...prev, show: false })); onClose(); }}
                    className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl">
                    Close Sheet
                  </button>
                </div>
              )}

              {/* Error View */}
              {txModal.state === "error" && (
                <div className="space-y-4 py-2 text-center">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto text-lg">
                    <AlertCircle />
                  </div>
                  <h5 className="font-bold text-zinc-100">Transaction Failed</h5>
                  <p className="text-xs text-rose-300 leading-normal px-2">
                    {txModal.errorMsg || "Transaction rejected or network error occurred."}
                  </p>
                  <button onClick={() => setTxModal(prev => ({ ...prev, state: "confirm" }))}
                    className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl">
                    Try Again
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.1 }}
        className="fixed inset-x-0 bottom-0 z-[60] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800 shrink-0">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-zinc-100 flex-1">Auction Details</h3>
          {data && !isOwner && (
            <button onClick={() => setShowReport(!showReport)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-500 hover:text-rose-400">
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>
          ) : data ? (
            <div className="p-4 space-y-5">
              {/* Listing owner */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden">
                  {data.auction.seller.avatar
                    ? <img src={data.auction.seller.avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">{data.auction.seller.username?.[0]?.toUpperCase()}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-100">{data.auction.seller.username}</p>
                  <p className="text-xs text-zinc-500 flex items-center gap-1 font-mono mt-0.5">
                    {timeLeft !== 'Ended' ? <span className="text-fuchsia-400 font-semibold">{timeLeft} left</span> : <span className="text-zinc-500">Ended</span>}
                    <span className="mx-1">·</span> <StatusBadge status={data.auction.status} isHighestBidder={isHighestBidder} />
                  </p>
                </div>
              </div>

              {/* Report form */}
              <AnimatePresence>
                {showReport && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 space-y-2 overflow-hidden">
                    <p className="text-xs font-semibold text-rose-400">Report this auction</p>
                    <input value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Reason for report…"
                      className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none" />
                    <button onClick={handleReport} disabled={!reportReason.trim()}
                      className="w-full h-8 bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl disabled:opacity-40 transition-all">
                      Submit Report
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card visual details */}
              <div className="flex flex-col items-center bg-zinc-900/40 border border-zinc-800/40 rounded-3xl p-4 space-y-4">
                <CardThumb card={data.auction.card} size={110} />
                <div className="text-center">
                  <h4 className="text-base font-black text-zinc-100">{data.auction.card.name}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{data.auction.card.rarity || 'Common rarity'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full border-t border-zinc-800/60 pt-4 font-mono text-center">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Highest Bid</span>
                    <span className="text-lg font-black text-fuchsia-400 block mt-1">{highestBidVal.toFixed(2)} USDC</span>
                    <span className="text-[9px] text-zinc-600 block mt-0.5">Start: {data.auction.start_price.toFixed(2)} USDC</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Buyout</span>
                    <span className="text-lg font-black text-emerald-400 block mt-1">
                      {data.auction.buyout_price ? `${data.auction.buyout_price.toFixed(2)} USDC` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions details if completed */}
              {data.auction.status === 'completed' && data.auction.tx_hash && (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3.5 space-y-2">
                  <p className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Auction Settled & Transferred
                  </p>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Sold to {data.auction.winner?.username || 'bidder'} for {highestBidVal.toFixed(2)} USDC.
                  </p>
                  <a href={`https://basescan.org/tx/${data.auction.tx_hash}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-sky-300 underline">
                    Verify tx on BaseScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Action buttons (Bidding / Buying / Paying) */}
              {!isOwner && userId && data.auction.status === "active" && !isEnded && (
                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl p-4 space-y-4">
                  {/* Bidding row */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Place Bid (Soft-Commitment)</p>
                    <div className="flex gap-2">
                      <input value={bidAmount} onChange={e => setBidAmount(e.target.value)} type="number" step="0.1"
                        className="flex-1 h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 font-mono" />
                      <button onClick={handlePlaceBid} disabled={submitting || !bidAmount || parseFloat(bidAmount) <= highestBidVal}
                        className="px-6 h-11 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Place Bid"}
                      </button>
                    </div>
                  </div>

                  {/* Buyout Option */}
                  {data.auction.buyout_price && (
                    <div className="border-t border-zinc-800/60 pt-3">
                      <button onClick={triggerOnChainPayment}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg">
                        <Coins className="w-4.5 h-4.5" /> Buy Now ({data.auction.buyout_price.toFixed(2)} USDC)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Pay and Claim for pending_payment won auctions */}
              {!isOwner && userId && data.auction.status === "pending_payment" && isHighestBidder && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-300">Congratulations! You Won the Auction 🏆</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Please pay **{highestBidVal.toFixed(2)} USDC** to the seller via on-chain Base to claim your card.
                  </p>
                  <button onClick={triggerOnChainPayment}
                    className="w-full h-12 bg-amber-500 text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-lg transition-all hover:bg-amber-400">
                    <Coins className="w-4.5 h-4.5" /> Pay & Claim Card
                  </button>
                </div>
              )}

              {/* Owner actions */}
              {isOwner && (data.auction.status === "active" || data.auction.status === "pending_payment") && (
                <button onClick={handleCancelAuction}
                  className="w-full h-10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-500/5 transition-all">
                  <X className="w-3.5 h-3.5" /> Cancel Auction (Void Bids)
                </button>
              )}

              {/* Bid History */}
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Bid History ({data.bids.length})
                </p>

                {data.bids.length === 0 ? (
                  <div className="text-center py-6 text-zinc-600 text-sm bg-zinc-900/30 rounded-2xl border border-zinc-800/40 border-dashed">
                    No bids placed yet
                  </div>
                ) : (
                  data.bids.map((b, idx) => (
                    <div key={b.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 font-mono w-4">#{data.bids.length - idx}</span>
                        <div className="w-6 h-6 rounded-md bg-zinc-800 overflow-hidden">
                          {b.bidder.avatar ? <img src={b.bidder.avatar} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <span className="text-xs font-bold text-zinc-300">{b.bidder.username}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-zinc-200 font-mono">{b.amount.toFixed(2)} USDC</span>
                        <span className="text-[9px] text-zinc-600 block">{timeAgo(b.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-zinc-600 text-sm">Failed to load auction details</div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { userId, walletAddress, usdcBalance, wishlist = {}, ownedCards = {}, setCollection } = useCollectionStore();
  const [view, setView] = useState<View>("feed");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [myListings, setMyListings] = useState<Auction[]>([]);
  const [myBids, setMyBids] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "info" } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  // Check URL params for deep-linked auctionId
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlAuctionId = params.get("auctionId");
      if (urlAuctionId) {
        setSelectedAuctionId(urlAuctionId);
      }
    }
  }, []);

  const showToast = (msg: string, type: "ok" | "err" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const wishlistCardIds = Object.keys(wishlist).filter(id => wishlist[id]);

  // Sync wallet balance helper
  const syncWalletBalance = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/collection?userId=${userId}`);
      const data = await res.json();
      setCollection({
        ownedCards: data.ownedCards || {},
        uniqueCards: data.uniqueCards || 0,
        collectionScore: data.collectionScore || 0,
        packsOpened: data.packsOpened || 0,
        walletAddress: data.walletAddress,
        usdcBalance: data.usdcBalance || 0
      });
      showToast("Wallet balance synced! 🪙");
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeed = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_feed",
          payload: { page: p, limit: 20, search, wishlistCardIds: wishlistOnly ? wishlistCardIds : [], userId }
        }),
      });
      const data = await res.json();
      if (reset) {
        setAuctions(data.auctions || []);
        setPage(2);
      } else {
        setAuctions(prev => [...prev, ...(data.auctions || [])]);
        setPage(prev => prev + 1);
      }
      setHasMore(p < (data.totalPages || 1));
    } catch (e) { console.error(e); }
    finally { setLoading(false); loadingRef.current = false; }
  }, [page, search, wishlistOnly, wishlistCardIds, userId]);

  const fetchMyAuctions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "my_auctions", payload: { userId } }),
      });
      const data = await res.json();
      setMyListings(data.auctions || []);
    } finally { setLoading(false); }
  }, [userId]);

  const fetchMyBids = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "my_bids", payload: { userId } }),
      });
      const data = await res.json();
      setMyBids(data.auctions || []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchFeed(true); }, [search, wishlistOnly]);
  useEffect(() => {
    if (view === "my_listings") fetchMyAuctions();
    else if (view === "my_bids") fetchMyBids();
  }, [view]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-950 text-white overflow-hidden">
      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Auction Detail Sheet */}
      <AnimatePresence>
        {selectedAuctionId && (
          <AuctionDetailSheet
            auctionId={selectedAuctionId} userId={userId}
            onClose={() => setSelectedAuctionId(null)}
            onRefresh={() => { fetchFeed(true); syncWalletBalance(); if (view === "my_listings") fetchMyAuctions(); }}
          />
        )}
      </AnimatePresence>

      {/* Create Listing Sheet */}
      <AnimatePresence>
        {showCreate && userId && (
          <CreateListingSheet
            userId={userId} ownedCards={ownedCards}
            onCreated={() => { setShowCreate(false); fetchFeed(true); showToast("Auction created! ⏳"); }}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* Header & Wallet Display */}
      <div className="shrink-0 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-zinc-100 flex items-center gap-2">
              <Store className="w-5 h-5 text-fuchsia-400" /> Auction House
            </h1>
            <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wider font-mono">Base Network USDC Auctions</p>
          </div>
          {userId && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg">
              <Plus className="w-3.5 h-3.5" /> Start Auction
            </button>
          )}
        </div>

        {/* Farcaster Wallet Card */}
        {walletAddress && (
          <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/40 p-2.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-zinc-500 leading-none">Farcaster Wallet</p>
                <p className="text-xs font-mono font-bold text-zinc-300 mt-1">{formatAddr(walletAddress)}</p>
              </div>
            </div>
            <button onClick={syncWalletBalance}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700/80 px-2.5 py-1.5 rounded-xl border border-zinc-800/60 text-xs font-bold text-zinc-100">
              <Coins className="w-3.5 h-3.5 text-emerald-400" /> {usdcBalance.toFixed(2)} <span className="text-[9.5px] font-normal text-zinc-500">USDC</span>
            </button>
          </div>
        )}

        {/* View Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800/60 p-0.5 rounded-xl">
          {(["feed", "my_listings", "my_bids"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${view === v ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              {v === "feed" ? "Auction Market" : v === "my_listings" ? "My Listings" : "My Bids"}
            </button>
          ))}
        </div>

        {/* Search + Filter (feed only) */}
        {view === "feed" && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search card name..."
                className="w-full h-9 pl-8 pr-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 transition-all" />
            </div>
            <button onClick={() => setWishlistOnly(!wishlistOnly)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 ${wishlistOnly ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-zinc-900 text-zinc-500 border-zinc-800"}`}>
              <Star className="w-3.5 h-3.5" /> Wishlist
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">

        {/* Feed View */}
        {view === "feed" && (
          <>
            {loading && auctions.length === 0 && (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>
            )}
            {!loading && auctions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Store className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500 font-medium">No active auctions</p>
                <p className="text-xs text-zinc-600">Be the first to list a card for auction!</p>
                {userId && (
                  <button onClick={() => setShowCreate(true)}
                    className="mt-2 px-4 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all">
                    Start Auction
                  </button>
                )}
              </div>
            )}
            {auctions.map(a => (
              <AuctionCard key={a.id} auction={a} onTap={() => setSelectedAuctionId(a.id)} isOwnListing={false} />
            ))}
            {hasMore && auctions.length > 0 && (
              <button onClick={() => fetchFeed(false)} disabled={loading}
                className="w-full h-10 border border-zinc-800 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all flex items-center justify-center gap-1.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
              </button>
            )}
          </>
        )}

        {/* My Listings View */}
        {view === "my_listings" && (
          <>
            {loading && <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>}
            {!loading && myListings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Package className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">You have not created any auctions yet</p>
                <button onClick={() => setShowCreate(true)}
                  className="px-4 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all">
                  Start Your First Auction
                </button>
              </div>
            )}
            {myListings.map(a => (
              <div key={a.id} className="relative">
                <AuctionCard auction={a} onTap={() => setSelectedAuctionId(a.id)} isOwnListing={true} />
                <div className="absolute top-3.5 right-3.5">
                  <StatusBadge status={a.status} isHighestBidder={false} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* My Bids View */}
        {view === "my_bids" && (
          <>
            {loading && <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>}
            {!loading && myBids.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <ArrowLeftRight className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">No bids placed yet</p>
                <p className="text-xs text-zinc-600">Find cards in the market and start bidding!</p>
              </div>
            )}
            {myBids.map(a => {
              const isHighest = a.highest_bidder_id === userId;
              let bidLabelState = "";
              if (a.status === 'active') {
                bidLabelState = isHighest ? "WINNING" : "OUTBID";
              } else if (a.status === 'pending_payment') {
                bidLabelState = isHighest ? "PENDING CLAIM PAYMENT" : "LOST";
              } else if (a.status === 'completed') {
                bidLabelState = isHighest ? "WON & CLAIMED" : "LOST";
              } else {
                bidLabelState = a.status.toUpperCase();
              }

              return (
                <button key={a.id} onClick={() => setSelectedAuctionId(a.id)}
                  className="w-full text-left bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      Auction by <span className="text-zinc-300 font-semibold">{a.seller?.username || "Trainer"}</span>
                    </span>
                    <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      bidLabelState.includes('WINNING') || bidLabelState.includes('WON') ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
                      bidLabelState.includes('OUTBID') || bidLabelState.includes('LOST') ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" :
                      "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    }`}>
                      {bidLabelState}
                    </span>
                  </div>

                  <div className="flex gap-2.5">
                    <CardThumb card={a.card} size={36} />
                    <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200 truncate">{a.card.name}</h4>
                        <p className="text-[9px] text-zinc-500 truncate">{a.card.rarity || 'Common'}</p>
                      </div>
                      <div className="flex justify-between items-baseline font-mono text-[10px] text-zinc-400">
                        <span>Highest Bid: {a.highest_bid.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Bottom padding for nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}

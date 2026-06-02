"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Plus, Search, X, Star, ChevronRight,
  Clock, ArrowLeftRight, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, Loader2, Flag,
  Heart, Package, RotateCcw, Filter
} from "lucide-react";
import { useCollectionStore } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CardMeta { id: string; name: string; smallImage?: string; largeImage?: string; rarity?: string; setId?: string; }
interface Listing {
  id: string; user: { id: string; username: string; avatar: string; fid: number };
  wantCards: CardMeta[]; offerCards: CardMeta[];
  want_card_ids: string[]; offer_card_ids: string[];
  note?: string; status: string; created_at: string; offerCount: number; wishlistMatch: boolean;
}
interface Offer {
  id: string; offerer: { id: string; username: string; avatar: string };
  offerCards: CardMeta[]; wantCards: CardMeta[];
  offer_card_ids: string[]; want_card_ids: string[];
  note?: string; status: string; created_at: string;
}
type View = "feed" | "my_listings" | "my_offers";

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
    <div style={{ width: size, height: size * 1.4 }} className="rounded-lg overflow-hidden bg-zinc-800 shrink-0 relative">
      {src && !err ? (
        <Image src={src} alt={card.name} fill className="object-contain" onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500 font-mono p-1 text-center leading-tight">{card.name}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    completed: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    cancelled: "bg-zinc-700/50 text-zinc-400 border-zinc-700",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    rejected: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  };
  return (
    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status] || map.active}`}>
      {status}
    </span>
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err" | "info"; onClose: () => void }) {
  const c = { ok: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", err: "bg-rose-500/15 border-rose-500/30 text-rose-300", info: "bg-sky-500/15 border-sky-500/30 text-sky-300" };
  return (
    <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 z-[999] flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-sm mx-auto ${c[type]}`}>
      {type === "ok" && <CheckCircle className="w-4 h-4 shrink-0" />}
      {type === "err" && <XCircle className="w-4 h-4 shrink-0" />}
      {type === "info" && <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="text-sm font-medium flex-1">{msg}</span>
      <button onClick={onClose}><X className="w-4 h-4 opacity-60" /></button>
    </motion.div>
  );
}

// ─── Card Picker (search + multi-select) ──────────────────────────────────────
function CardPicker({ title, onlyOwned = false, ownedCards = {}, selectedIds, onToggle, onClose }: {
  title: string; onlyOwned?: boolean; ownedCards?: Record<string, number>;
  selectedIds: string[]; onToggle: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<CardMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const selected = new Set(selectedIds);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const url = `/api/cards?limit=40&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      let result = data.cards || [];
      if (onlyOwned) {
        result = result.filter((c: CardMeta) => ownedCards[c.id] > 0);
      }
      setCards(result);
    } finally { setLoading(false); }
  }, [onlyOwned, ownedCards]);

  useEffect(() => { search(""); }, []);
  useEffect(() => {
    const t = setTimeout(() => search(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-zinc-100 flex-1">{title}</h3>
        <span className="text-xs text-fuchsia-400 font-mono">{selectedIds.length} selected</span>
      </div>
      <div className="px-4 py-2 border-b border-zinc-800/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search cards…"
            className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
        {loading && <div className="col-span-3 py-12 flex justify-center"><Loader2 className="w-6 h-6 text-fuchsia-500 animate-spin" /></div>}
        {!loading && cards.map(card => {
          const isSelected = selected.has(card.id);
          return (
            <button key={card.id} onClick={() => onToggle(card.id)}
              className={`relative flex flex-col items-center rounded-2xl p-2 border transition-all ${isSelected ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-zinc-800/60 bg-zinc-900/60 active:scale-95"}`}>
              <CardThumb card={card} size={60} />
              <p className="text-[9px] text-zinc-300 mt-1 text-center leading-tight line-clamp-2">{card.name}</p>
              {onlyOwned && ownedCards[card.id] > 1 && (
                <span className="text-[8px] font-bold text-amber-400">×{ownedCards[card.id]}</span>
              )}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
        {!loading && cards.length === 0 && (
          <div className="col-span-3 py-12 text-center text-zinc-600 text-sm">No cards found</div>
        )}
      </div>
      <div className="p-4 border-t border-zinc-800">
        <button onClick={onClose} disabled={selectedIds.length === 0}
          className="w-full h-12 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all">
          Confirm {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
        </button>
      </div>
    </div>
  );
}

// ─── Create Listing Sheet ─────────────────────────────────────────────────────
function CreateListingSheet({ userId, ownedCards, onCreated, onClose }: {
  userId: string; ownedCards: Record<string, number>; onCreated: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<"want" | "offer" | "review">("want");
  const [wantIds, setWantIds] = useState<string[]>([]);
  const [offerIds, setOfferIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<"want" | "offer" | null>(null);

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const handleSubmit = async () => {
    if (!wantIds.length || !offerIds.length) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_listing", payload: { userId, wantCardIds: wantIds, offerCardIds: offerIds, note } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated();
    } catch (e: any) {
      alert(e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      {picker && (
        <CardPicker
          title={picker === "want" ? "Cards You Want" : "Cards You're Offering"}
          onlyOwned={picker === "offer"}
          ownedCards={ownedCards}
          selectedIds={picker === "want" ? wantIds : offerIds}
          onToggle={id => picker === "want" ? setWantIds(prev => toggleId(prev, id)) : setOfferIds(prev => toggleId(prev, id))}
          onClose={() => setPicker(null)}
        />
      )}

      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15 }}
        className="fixed inset-x-0 bottom-0 z-40 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-zinc-100 flex-1">Post a Listing</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Want section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Looking For</p>
              <button onClick={() => setPicker("want")}
                className="flex items-center gap-1 text-xs text-fuchsia-400 font-semibold">
                <Plus className="w-3.5 h-3.5" /> Add Cards
              </button>
            </div>
            {wantIds.length === 0 ? (
              <button onClick={() => setPicker("want")}
                className="w-full h-20 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-sm flex items-center justify-center gap-2 hover:border-fuchsia-500/40 hover:text-zinc-500 transition-all">
                <Plus className="w-4 h-4" /> Select cards you want
              </button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {wantIds.map(id => (
                  <div key={id} className="relative">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 flex flex-col items-center gap-1">
                      <div className="w-12 h-16 bg-zinc-800 rounded-lg flex items-center justify-center text-[8px] text-zinc-500 text-center">
                        <span className="font-mono">{id.slice(-6)}</span>
                      </div>
                    </div>
                    <button onClick={() => setWantIds(prev => prev.filter(x => x !== id))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setPicker("want")} className="w-10 h-[70px] border border-dashed border-zinc-700 rounded-xl flex items-center justify-center text-zinc-600 hover:border-fuchsia-500/40 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Offer section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Your Offer</p>
              <button onClick={() => setPicker("offer")}
                className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                <Plus className="w-3.5 h-3.5" /> Add Cards
              </button>
            </div>
            {offerIds.length === 0 ? (
              <button onClick={() => setPicker("offer")}
                className="w-full h-20 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-sm flex items-center justify-center gap-2 hover:border-emerald-500/40 hover:text-zinc-500 transition-all">
                <Package className="w-4 h-4" /> Select cards to offer
              </button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {offerIds.map(id => (
                  <div key={id} className="relative">
                    <div className="bg-zinc-900 border border-emerald-500/20 rounded-xl p-1.5 flex flex-col items-center gap-1">
                      <div className="w-12 h-16 bg-zinc-800 rounded-lg flex items-center justify-center text-[8px] text-zinc-500 text-center">
                        <span className="font-mono">{id.slice(-6)}</span>
                      </div>
                    </div>
                    <button onClick={() => setOfferIds(prev => prev.filter(x => x !== id))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setPicker("offer")} className="w-10 h-[70px] border border-dashed border-zinc-700 rounded-xl flex items-center justify-center text-zinc-600 hover:border-emerald-500/40 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Note (optional)</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note to your listing…" rows={2}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button onClick={handleSubmit} disabled={submitting || !wantIds.length || !offerIds.length}
            className="w-full h-12 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Store className="w-5 h-5" />}
            {submitting ? "Posting…" : "Post Listing"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({ listing, onTap }: { listing: Listing; onTap: () => void }) {
  return (
    <motion.button
      onClick={onTap} whileTap={{ scale: 0.98 }}
      className={`w-full text-left bg-zinc-900/60 border rounded-2xl p-3.5 space-y-3 transition-all active:scale-[0.98] ${listing.wishlistMatch ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.07)]" : "border-zinc-800/60"}`}>
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-zinc-800 overflow-hidden shrink-0">
          {listing.user.avatar
            ? <img src={listing.user.avatar} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-bold">{listing.user.username?.[0]?.toUpperCase()}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-zinc-200">{listing.user.username}</span>
            {listing.wishlistMatch && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5" /> Wishlist Match
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {timeAgo(listing.created_at)}
            {listing.offerCount > 0 && <><span className="mx-1">·</span><span className="text-fuchsia-400 font-semibold">{listing.offerCount} offer{listing.offerCount !== 1 ? "s" : ""}</span></>}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Wants</p>
          <div className="flex gap-1 flex-wrap">
            {listing.wantCards.slice(0, 4).map(c => <CardThumb key={c.id} card={c} size={36} />)}
            {listing.wantCards.length > 4 && <div className="w-9 h-[50px] rounded-lg bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-500 font-mono">+{listing.wantCards.length - 4}</div>}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Offers</p>
          <div className="flex gap-1 flex-wrap">
            {listing.offerCards.slice(0, 4).map(c => <CardThumb key={c.id} card={c} size={36} />)}
            {listing.offerCards.length > 4 && <div className="w-9 h-[50px] rounded-lg bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-500 font-mono">+{listing.offerCards.length - 4}</div>}
          </div>
        </div>
      </div>

      {listing.note && <p className="text-xs text-zinc-500 italic leading-snug">"{listing.note}"</p>}
    </motion.button>
  );
}

// ─── Listing Detail Sheet ──────────────────────────────────────────────────────
function ListingDetailSheet({ listingId, userId, ownedCards, wishlist, onClose, onRefresh }: {
  listingId: string; userId: string | null; ownedCards: Record<string, number>; wishlist: Record<string, boolean>;
  onClose: () => void; onRefresh: () => void;
}) {
  const [data, setData] = useState<{ listing: Listing; offers: Offer[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerPicker, setOfferPicker] = useState(false);
  const [offerIds, setOfferIds] = useState<string[]>([]);
  const [wantFromListing, setWantFromListing] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "info" } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_listing", payload: { listingId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      // Pre-select all want cards from listing as "what I want from them"
      setWantFromListing(d.listing.want_card_ids || []);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = data?.listing?.user?.id === userId;

  const handleSendOffer = async () => {
    if (!userId || !offerIds.length) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_offer", payload: { listingId, offererId: userId, offerCardIds: offerIds, wantCardIds: wantFromListing, note } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Offer sent! 🎴");
      setOfferIds([]); setNote("");
      load();
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setSubmitting(false); }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_offer", payload: { offerId, userId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Trade complete! Cards transferred. 🎉");
      onRefresh(); load();
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setSubmitting(false); }
  };

  const handleRejectOffer = async (offerId: string) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_offer", payload: { offerId, userId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Offer rejected");
      load();
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const handleCancelListing = async () => {
    if (!userId || !data) return;
    if (!confirm("Cancel this listing? All pending offers will be rejected.")) return;
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_listing", payload: { listingId, userId } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Listing cancelled");
      onRefresh(); onClose();
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const handleReport = async () => {
    if (!userId || !reportReason.trim()) return;
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report_listing", payload: { listingId, reporterUserId: userId, reason: reportReason } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      showToast("Report submitted. Thank you!", "info");
      setShowReport(false); setReportReason("");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const toggleWantFromListing = (id: string) => {
    setWantFromListing(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <>
      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>
      {offerPicker && (
        <CardPicker title="Cards to Offer" onlyOwned ownedCards={ownedCards}
          selectedIds={offerIds}
          onToggle={id => setOfferIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          onClose={() => setOfferPicker(false)} />
      )}

      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.1 }}
        className="fixed inset-x-0 bottom-0 z-30 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800 shrink-0">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-zinc-100 flex-1">Listing Details</h3>
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
                  {data.listing.user.avatar
                    ? <img src={data.listing.user.avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">{data.listing.user.username?.[0]?.toUpperCase()}</div>}
                </div>
                <div>
                  <p className="font-bold text-zinc-100">{data.listing.user.username}</p>
                  <p className="text-xs text-zinc-500">{timeAgo(data.listing.created_at)} · <StatusBadge status={data.listing.status} /></p>
                </div>
              </div>

              {/* Report form */}
              <AnimatePresence>
                {showReport && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 space-y-2 overflow-hidden">
                    <p className="text-xs font-semibold text-rose-400">Report this listing</p>
                    <input value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Reason for report…"
                      className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none" />
                    <button onClick={handleReport} disabled={!reportReason.trim()}
                      className="w-full h-8 bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl disabled:opacity-40 transition-all">
                      Submit Report
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Looking For</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.listing.wantCards.map(c => (
                      <div key={c.id} className={`relative cursor-pointer rounded-lg transition-all ${wishlist[c.id] ? "ring-2 ring-amber-500" : ""}`}
                        onClick={() => !isOwner && toggleWantFromListing(c.id)}>
                        <CardThumb card={c} size={44} />
                        {wishlist[c.id] && <Star className="absolute -top-1 -right-1 w-3 h-3 text-amber-400 fill-amber-400" />}
                        {!isOwner && wantFromListing.includes(c.id) && (
                          <div className="absolute inset-0 bg-fuchsia-500/20 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-fuchsia-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Offering</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.listing.offerCards.map(c => <CardThumb key={c.id} card={c} size={44} />)}
                  </div>
                </div>
              </div>

              {data.listing.note && (
                <p className="text-sm text-zinc-400 italic bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-3 py-2">"{data.listing.note}"</p>
              )}

              {/* Owner actions */}
              {isOwner && data.listing.status === "active" && (
                <button onClick={handleCancelListing}
                  className="w-full h-10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-500/5 transition-all">
                  <X className="w-3.5 h-3.5" /> Cancel Listing
                </button>
              )}

              {/* Offers section */}
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Offers ({data.offers.length})
                </p>

                {data.offers.length === 0 ? (
                  <div className="text-center py-6 text-zinc-600 text-sm bg-zinc-900/30 rounded-2xl border border-zinc-800/40 border-dashed">
                    No offers yet
                  </div>
                ) : (
                  data.offers.map(offer => (
                    <div key={offer.id} className={`bg-zinc-900/60 border rounded-2xl p-3 space-y-3 ${offer.status === "accepted" ? "border-emerald-500/30" : "border-zinc-800/60"}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 overflow-hidden">
                          {offer.offerer.avatar ? <img src={offer.offerer.avatar} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-zinc-200">{offer.offerer.username}</span>
                          <span className="text-[10px] text-zinc-600 ml-2">{timeAgo(offer.created_at)}</span>
                        </div>
                        <StatusBadge status={offer.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div className="space-y-1">
                          <p className="font-mono uppercase tracking-widest text-zinc-500">They Give</p>
                          <div className="flex gap-1 flex-wrap">
                            {offer.offerCards.map(c => <CardThumb key={c.id} card={c} size={32} />)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="font-mono uppercase tracking-widest text-zinc-500">They Want</p>
                          <div className="flex gap-1 flex-wrap">
                            {offer.wantCards.map(c => <CardThumb key={c.id} card={c} size={32} />)}
                          </div>
                        </div>
                      </div>

                      {offer.note && <p className="text-xs text-zinc-500 italic">"{offer.note}"</p>}

                      {isOwner && offer.status === "pending" && data.listing.status === "active" && (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleAcceptOffer(offer.id)} disabled={submitting}
                            className="h-9 bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-all hover:bg-emerald-500/25">
                            <CheckCircle className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button onClick={() => handleRejectOffer(offer.id)} disabled={submitting}
                            className="h-9 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-all hover:bg-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Make offer section (non-owner, active listing) */}
              {!isOwner && userId && data.listing.status === "active" && (
                <div className="bg-zinc-900/60 border border-fuchsia-500/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-fuchsia-400">Make an Offer</p>
                  <p className="text-[10px] text-zinc-500">Tap cards above to select which ones you want. Then pick what you'll offer:</p>

                  <button onClick={() => setOfferPicker(true)}
                    className="w-full h-10 border border-dashed border-zinc-700 rounded-xl text-xs text-zinc-500 flex items-center justify-center gap-1.5 hover:border-fuchsia-500/40 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Select Cards to Offer ({offerIds.length} selected)
                  </button>

                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)…" rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none" />

                  <button onClick={handleSendOffer} disabled={submitting || !offerIds.length || !wantFromListing.length}
                    className="w-full h-10 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                    {submitting ? "Sending…" : "Send Offer"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-600 text-sm">Failed to load listing</div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { userId, wishlist = {}, ownedCards = {} } = useCollectionStore();
  const [view, setView] = useState<View>("feed");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "info" } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const showToast = (msg: string, type: "ok" | "err" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const wishlistCardIds = Object.keys(wishlist).filter(id => wishlist[id]);

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
        setListings(data.listings || []);
        setPage(2);
      } else {
        setListings(prev => [...prev, ...(data.listings || [])]);
        setPage(prev => prev + 1);
      }
      setHasMore(p < (data.totalPages || 1));
    } catch (e) { console.error(e); }
    finally { setLoading(false); loadingRef.current = false; }
  }, [page, search, wishlistOnly, wishlistCardIds, userId]);

  const fetchMyListings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "my_listings", payload: { userId } }),
      });
      const data = await res.json();
      setMyListings(data.listings || []);
    } finally { setLoading(false); }
  }, [userId]);

  const fetchMyOffers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "my_offers", payload: { userId } }),
      });
      const data = await res.json();
      setMyOffers(data.offers || []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchFeed(true); }, [search, wishlistOnly]);
  useEffect(() => {
    if (view === "my_listings") fetchMyListings();
    else if (view === "my_offers") fetchMyOffers();
  }, [view]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-950 text-white overflow-hidden">
      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Listing Detail Sheet */}
      <AnimatePresence>
        {selectedListingId && (
          <ListingDetailSheet
            listingId={selectedListingId} userId={userId} ownedCards={ownedCards} wishlist={wishlist}
            onClose={() => setSelectedListingId(null)}
            onRefresh={() => { fetchFeed(true); if (view === "my_listings") fetchMyListings(); }}
          />
        )}
      </AnimatePresence>

      {/* Create Listing Sheet */}
      <AnimatePresence>
        {showCreate && userId && (
          <CreateListingSheet
            userId={userId} ownedCards={ownedCards}
            onCreated={() => { setShowCreate(false); fetchFeed(true); showToast("Listing posted! 🎴"); }}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="shrink-0 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-zinc-100 flex items-center gap-2">
              <Store className="w-5 h-5 text-fuchsia-400" /> Marketplace
            </h1>
            <p className="text-[10px] text-zinc-600 mt-0.5">Public trade board</p>
          </div>
          {userId && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all">
              <Plus className="w-3.5 h-3.5" /> Post
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800/60 p-0.5 rounded-xl">
          {(["feed", "my_listings", "my_offers"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${view === v ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              {v === "feed" ? "Feed" : v === "my_listings" ? "My Listings" : "My Offers"}
            </button>
          ))}
        </div>

        {/* Search + Filter (feed only) */}
        {view === "feed" && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards…"
                className="w-full h-9 pl-8 pr-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 transition-all" />
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

        {/* Feed */}
        {view === "feed" && (
          <>
            {loading && listings.length === 0 && (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>
            )}
            {!loading && listings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Store className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500 font-medium">No listings yet</p>
                <p className="text-xs text-zinc-600">Be the first to post a trade!</p>
                {userId && (
                  <button onClick={() => setShowCreate(true)}
                    className="mt-2 px-4 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all">
                    Post Listing
                  </button>
                )}
              </div>
            )}
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} onTap={() => setSelectedListingId(l.id)} />
            ))}
            {hasMore && listings.length > 0 && (
              <button onClick={() => fetchFeed(false)} disabled={loading}
                className="w-full h-10 border border-zinc-800 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all flex items-center justify-center gap-1.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
              </button>
            )}
          </>
        )}

        {/* My Listings */}
        {view === "my_listings" && (
          <>
            {loading && <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>}
            {!loading && myListings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Package className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">No listings yet</p>
                <button onClick={() => setShowCreate(true)}
                  className="px-4 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all">
                  Post Your First Listing
                </button>
              </div>
            )}
            {myListings.map(l => (
              <div key={l.id} className="relative">
                <ListingCard listing={l} onTap={() => setSelectedListingId(l.id)} />
                <div className="absolute top-3 right-3">
                  <StatusBadge status={l.status} />
                </div>
                {l.offerCount > 0 && l.status === "active" && (
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-fuchsia-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {l.offerCount}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* My Offers */}
        {view === "my_offers" && (
          <>
            {loading && <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" /></div>}
            {!loading && myOffers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <ArrowLeftRight className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">No offers made yet</p>
                <p className="text-xs text-zinc-600">Browse the feed and make an offer!</p>
              </div>
            )}
            {myOffers.map(offer => (
              <button key={offer.id} onClick={() => offer.listing && setSelectedListingId(offer.listing.id)}
                className="w-full text-left bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    Offer on listing by <span className="text-zinc-300 font-semibold">{offer.listing?.user?.username || "Unknown"}</span>
                  </div>
                  <StatusBadge status={offer.status} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">You Offer</p>
                    <div className="flex gap-1">{offer.offerCards.slice(0, 4).map((c: CardMeta) => <CardThumb key={c.id} card={c} size={32} />)}</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">You Want</p>
                    <div className="flex gap-1">{offer.wantCards.slice(0, 4).map((c: CardMeta) => <CardThumb key={c.id} card={c} size={32} />)}</div>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(offer.created_at)}</p>
              </button>
            ))}
          </>
        )}

        {/* Bottom padding for nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}

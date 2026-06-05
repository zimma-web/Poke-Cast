"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Layers,
  PackageOpen,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Database,
  Activity,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  Cpu,
  Plus,
  Save,
  CheckCircle,
  AlertCircle,
  Lock,
  LogOut,
  ShieldCheck,
  Ban,
  Ticket,
  Star,
  Calendar,
  TrendingUp,
  Eye,
  EyeOff,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Flame,
  Trophy,
  Heart,
  Package,
  RotateCcw,
  ArrowLeftRight,
} from "lucide-react";


type Tab = "overview" | "users" | "quests" | "packs" | "events" | "cards" | "analytics" | "audit" | "market" | "logs";

// ─── Small helper components ──────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-black border-2 border-dotted border-[#2A3FE5] p-4 flex items-start gap-3 hover:border-[#F4B9B0] transition-colors rounded-none">
      <div className={`w-10 h-10 border border-dotted border-[#2A3FE5] flex items-center justify-center shrink-0 text-white ${accent || "bg-black text-[#F4B9B0]"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#F4B9B0] mb-1.5 pacman-mono">{label}</p>
        <p className="text-sm font-black text-white leading-none tracking-wider">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-[9px] text-zinc-500 mt-1.5 pacman-mono">{sub}</p>}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  const borderColors = {
    success: "border-[#16A34A] text-[#16A34A]",
    error: "border-[#DC2626] text-[#DC2626]",
    info: "border-[#2A3FE5] text-[#2A3FE5]",
  };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-black border-4 border-double shadow-[4px_4px_0px_rgba(255,255,255,0.15)] max-w-sm animate-in slide-in-from-right-4 rounded-none ${borderColors[type] || "border-white text-white"}`}>
      {type === "success" && <CheckCircle className="w-4 h-4 shrink-0 text-[#16A34A]" />}
      {type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />}
      {type === "info" && <Clock className="w-4 h-4 shrink-0 text-[#2A3FE5]" />}
      <span className="text-[10px] font-bold uppercase tracking-wider text-white">{message}</span>
      <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}

function Badge({ children, color = "zinc" }: { children: React.ReactNode; color?: "zinc" | "fuchsia" | "emerald" | "rose" | "amber" | "sky" }) {
  const colors = {
    zinc: "border-zinc-700 text-zinc-400 bg-black",
    fuchsia: "border-[#F4B9B0] text-[#F4B9B0] bg-black",
    emerald: "border-[#16A34A] text-[#16A34A] bg-black",
    rose: "border-[#DC2626] text-[#DC2626] bg-black",
    amber: "border-[#D97706] text-[#D97706] bg-black",
    sky: "border-[#2A3FE5] text-[#2A3FE5] bg-black",
  };
  return <span className={`text-[8px] font-bold uppercase px-2 py-0.5 border border-solid rounded-none pacman-mono ${colors[color]}`}>{children}</span>;
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 pb-2 border-b border-dotted border-[#2A3FE5]">
      <h2 className="text-[11px] font-black text-[#F4B9B0] uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );
}

// ─── Mini bar chart for DAU ───────────────────────────────────────────────────
function BarChart({ data }: { data: { date: string; users: number }[] }) {
  const max = Math.max(...data.map(d => d.users), 1);
  return (
    <div className="flex items-end gap-2 h-28 w-full border-b border-l border-dotted border-[#2A3FE5] p-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-[#2A3FE5] border border-solid border-[#F4B9B0] transition-all group-hover:bg-[#F4B9B0] relative rounded-none"
            style={{ height: `${Math.max(4, (d.users / max) * 80)}px` }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-solid border-[#F4B9B0] text-white text-[8px] px-1.5 py-0.5 rounded-none opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 pacman-mono">
              {d.users} users
            </div>
          </div>
          <span className="text-[8px] text-[#F4B9B0] font-mono mt-1 pacman-mono">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserCards, setSelectedUserCards] = useState<any[]>([]);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardSearch, setCardSearch] = useState("");
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSetFilter, setSelectedSetFilter] = useState("");
  const [packs, setPacks] = useState<any[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [grantCardCount, setGrantCardCount] = useState(10);
  const [ticketAmount, setTicketAmount] = useState(10);
  const [banReason, setBanReason] = useState("");
  const [simResults, setSimResults] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [pointsAmount, setPointsAmount] = useState(100);
  const [pointsReason, setPointsReason] = useState("");
  const [eventForm, setEventForm] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  // Marketplace admin state
  const [marketListings, setMarketListings] = useState<any[]>([]);
  const [marketReports, setMarketReports] = useState<any[]>([]);
  const [marketStats, setMarketStats] = useState<{ totalActive: number; totalBids: number; unresolvedReports: number } | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [packSearch, setPackSearch] = useState("");

  // Quests state
  const [questsList, setQuestsList] = useState<any[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [editingQuest, setEditingQuest] = useState<any>(null);

  // Live Logs state
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Auth state: dual-mode (role-based via FID or legacy password)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<"farcaster" | "password">("password");

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Centralized admin fetch (supports both auth modes) ───────────────────
  const adminFetch = useCallback(async (action: string, payload?: any) => {
    const storedPwd = adminPassword || sessionStorage.getItem("pokecast_admin_password") || "";
    const storedAdminId = adminUserId || sessionStorage.getItem("pokecast_admin_id") || null;

    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": storedPwd },
      body: JSON.stringify({ action, payload, adminUserId: storedAdminId }),
    });
    if (res.status === 401) {
      setIsAdminAuthorized(false);
      sessionStorage.removeItem("pokecast_admin_password");
      sessionStorage.removeItem("pokecast_admin_id");
      throw new Error("Session expired. Please login again.");
    }
    return res;
  }, [adminPassword, adminUserId]);

  // ─── Data fetchers ────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await adminFetch("stats");
      const data = await res.json();
      setStats(data);
    } catch (e: any) { showToast(e.message || "Failed to fetch stats", "error"); }
    finally { setLoadingStats(false); }
  }, [adminFetch, showToast]);

  const fetchUsers = useCallback(async (q = "") => {
    setLoadingUsers(true);
    try {
      const res = await adminFetch("users_list", { search: q });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: any) { showToast(e.message || "Failed to load users", "error"); }
    finally { setLoadingUsers(false); }
  }, [adminFetch, showToast]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const res = await adminFetch("user_detail", { userId });
      const data = await res.json();
      setSelectedUser(data.user);
      setSelectedUserCards(data.cards || []);
    } catch (e: any) { showToast(e.message || "Failed to load user detail", "error"); }
    finally { setLoadingUserDetail(false); }
  }, [adminFetch, showToast]);

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch("/api/sets?all=true");
      const data = await res.json();
      setSets(data.sets || []);
      if (data.sets?.length > 0 && !selectedSetFilter) setSelectedSetFilter(data.sets[0].id);
    } catch (e) { console.error(e); }
  }, [selectedSetFilter]);

  const fetchCards = useCallback(async () => {
    if (!selectedSetFilter) return;
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/cards?set=${selectedSetFilter}&limit=200&q=${cardSearch}`);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (e) { showToast("Failed to load cards", "error"); }
    finally { setLoadingCards(false); }
  }, [selectedSetFilter, cardSearch, showToast]);

  const fetchPacks = useCallback(async () => {
    setLoadingPacks(true);
    try {
      const res = await adminFetch("pack_list");
      const data = await res.json();
      setPacks(data.packs || []);
    } catch (e: any) { showToast(e.message || "Failed to load packs", "error"); }
    finally { setLoadingPacks(false); }
  }, [adminFetch, showToast]);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await adminFetch("event_list");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e: any) { showToast(e.message || "Failed to load events", "error"); }
    finally { setLoadingEvents(false); }
  }, [adminFetch, showToast]);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await adminFetch("analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (e: any) { showToast(e.message || "Failed to load analytics", "error"); }
    finally { setLoadingAnalytics(false); }
  }, [adminFetch, showToast]);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await adminFetch("audit_logs");
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) { console.error(e); }
    finally { setLoadingAudit(false); }
  }, [adminFetch]);

  const fetchQuests = useCallback(async () => {
    setLoadingQuests(true);
    try {
      const res = await adminFetch("admin_quests_list");
      const data = await res.json();
      setQuestsList(data.quests || []);
    } catch (e: any) { showToast(e.message || "Failed to load quest definitions", "error"); }
    finally { setLoadingQuests(false); }
  }, [adminFetch, showToast]);

  const fetchLiveLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await adminFetch("admin_live_logs", { limit: 100 });
      const data = await res.json();
      setLiveLogs(data.logs || []);
    } catch (e: any) { showToast(e.message || "Failed to load live logs", "error"); }
    finally { setLoadingLogs(false); }
  }, [adminFetch, showToast]);

  // ─── Auth init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedPwd = sessionStorage.getItem("pokecast_admin_password");
    const storedAdminId = sessionStorage.getItem("pokecast_admin_id");
    if (storedPwd) {
      setAdminPassword(storedPwd);
      if (storedAdminId) setAdminUserId(storedAdminId);
      setIsAdminAuthorized(true);
    } else {
      // Try to get FID from localStorage (set by Farcaster auth)
      const fid = localStorage.getItem("farcaster_user_id") || localStorage.getItem("pokecast_user_id");
      if (fid) { setAuthMode("farcaster"); }
      setIsAdminAuthorized(false);
    }
  }, []);

  // ─── Auto-load on authorization ──────────────────────────────────────────
  useEffect(() => {
    if (isAdminAuthorized === true) {
      fetchStats();
      fetchSets();
    }
  }, [isAdminAuthorized]);

  // ─── Tab-based data loading ───────────────────────────────────────────────
  const fetchMarketAdmin = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const storedPwd = adminPassword || sessionStorage.getItem("pokecast_admin_password") || "";
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": storedPwd },
        body: JSON.stringify({ action: "admin_auctions", payload: { limit: 50 } }),
      });
      const data = await res.json();
      setMarketListings(data.auctions || []);
      setMarketReports(data.reports || []);
      setMarketStats(data.stats || null);
    } catch (e: any) { showToast(e.message || "Failed to load marketplace data", "error"); }
    finally { setLoadingMarket(false); }
  }, [adminPassword, showToast]);

  const handleMarketRemoveListing = async (listingId: string) => {
    if (!confirm("Cancel and remove this auction? Any pending bids will be cancelled.")) return;
    const storedPwd = adminPassword || sessionStorage.getItem("pokecast_admin_password") || "";
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": storedPwd },
        body: JSON.stringify({ action: "admin_remove_listing", payload: { listingId } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Auction removed by admin");
      fetchMarketAdmin();
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const handleMarketResolveReport = async (reportId: string) => {
    const storedPwd = adminPassword || sessionStorage.getItem("pokecast_admin_password") || "";
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": storedPwd },
        body: JSON.stringify({ action: "admin_resolve_report", payload: { reportId } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Report resolved", "info");
      fetchMarketAdmin();
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const handleToggleAdmin = async (userId: string) => {
    try {
      const res = await adminFetch("toggle_admin", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(data.is_admin ? "Admin role granted" : "Admin role revoked");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleAdminAuctionCancel = async (auctionId: string) => {
    if (!confirm("Are you sure you want to FORCE CANCEL this auction? The card(s) will be unlocked and returned to the seller.")) return;
    try {
      const res = await adminFetch("admin_auction_cancel", { auctionId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Auction cancelled successfully", "success");
      fetchMarketAdmin();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleAdminAuctionComplete = async (auctionId: string) => {
    if (!confirm("Are you sure you want to FORCE COMPLETE this auction? This will transfer card ownership to the highest bidder and credit PokePoints to the seller.")) return;
    try {
      const res = await adminFetch("admin_auction_complete", { auctionId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Auction completed successfully", "success");
      fetchMarketAdmin();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleQuestSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuest) return;
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload = {
      questId: editingQuest.id,
      title: fd.get("title") as string,
      target: parseInt(fd.get("target") as string) || 1,
      reward: parseInt(fd.get("reward") as string) || 1,
      link: fd.get("link") as string || null,
      description: fd.get("description") as string || ""
    };
    try {
      const res = await adminFetch("admin_quest_update", payload);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Quest definition updated successfully", "success");
      setEditingQuest(null);
      fetchQuests();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  useEffect(() => {
    if (isAdminAuthorized !== true) return;
    if (activeTab === "users") fetchUsers(userSearch);
    else if (activeTab === "packs") fetchPacks();
    else if (activeTab === "events") fetchEvents();
    else if (activeTab === "cards") fetchCards();
    else if (activeTab === "analytics") fetchAnalytics();
    else if (activeTab === "audit") fetchAuditLogs();
    else if (activeTab === "market") fetchMarketAdmin();
    else if (activeTab === "quests") fetchQuests();
    else if (activeTab === "logs") fetchLiveLogs();
  }, [activeTab, isAdminAuthorized, fetchUsers, fetchPacks, fetchEvents, fetchCards, fetchAnalytics, fetchAuditLogs, fetchMarketAdmin, fetchQuests, fetchLiveLogs, userSearch]);

  useEffect(() => {
    if (activeTab === "cards" && isAdminAuthorized === true) fetchCards();
  }, [selectedSetFilter, cardSearch]);

  useEffect(() => {
    if (activeTab === "users" && isAdminAuthorized === true) fetchUsers(userSearch);
  }, [userSearch]);

  // ─── Login handler ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", payload: { password: adminPassword } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Incorrect password");
      sessionStorage.setItem("pokecast_admin_password", adminPassword);
      setIsAdminAuthorized(true);
      showToast("Access granted. Welcome to Admin Control Room!");
    } catch (err: any) {
      setLoginError(err.message || "Authentication failed");
    } finally { setLoginLoading(false); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("pokecast_admin_password");
    sessionStorage.removeItem("pokecast_admin_id");
    setAdminPassword("");
    setAdminUserId(null);
    setIsAdminAuthorized(false);
    showToast("Logged out", "info");
  };

  // ─── User action handlers ─────────────────────────────────────────────────
  const handleAddTickets = async (userId: string) => {
    try {
      const res = await adminFetch("add_tickets", { userId, amount: ticketAmount });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Added ${ticketAmount} tickets! New balance: ${data.newBalance}`);
      fetchUserDetail(userId);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleRemoveTickets = async (userId: string) => {
    try {
      const res = await adminFetch("remove_tickets", { userId, amount: ticketAmount });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Removed ${ticketAmount} tickets. New balance: ${data.newBalance}`);
      fetchUserDetail(userId);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleAddPoints = async (userId: string) => {
    try {
      const res = await adminFetch("add_points", { userId, amount: pointsAmount, reason: pointsReason });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Added ${pointsAmount} PokePoints! New balance: ${data.newPoints}`);
      setPointsReason("");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleRemovePoints = async (userId: string) => {
    try {
      const res = await adminFetch("remove_points", { userId, amount: pointsAmount, reason: pointsReason });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Removed ${pointsAmount} PokePoints. New balance: ${data.newPoints}`);
      setPointsReason("");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleBanUser = async (userId: string) => {
    if (!confirm(`Ban this user? Reason: ${banReason || "Admin action"}`)) return;
    try {
      const res = await adminFetch("ban_user", { userId, reason: banReason });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("User banned successfully");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const res = await adminFetch("unban_user", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("User unbanned successfully");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleHideUser = async (userId: string) => {
    try {
      const res = await adminFetch("hide_user", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("User hidden from public views");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleUnhideUser = async (userId: string) => {
    try {
      const res = await adminFetch("unhide_user", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("User unhidden from public views");
      fetchUserDetail(userId);
      fetchUsers(userSearch);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleResetStreak = async (userId: string) => {
    if (!confirm("Reset this user's login streak to 0?")) return;
    try {
      const res = await adminFetch("reset_streak", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Login streak reset to 0");
      fetchUserDetail(userId);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleUserDelete = async (userId: string) => {
    if (!confirm("Permanently delete this user and all their data? This cannot be undone!")) return;
    try {
      const res = await adminFetch("user_delete", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("User deleted permanently");
      setSelectedUser(null);
      fetchUsers(userSearch);
      fetchStats();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleUserClearCollection = async (userId: string) => {
    if (!confirm("Wipe ALL cards from this user's collection? This cannot be undone!")) return;
    try {
      const res = await adminFetch("user_clear", { userId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Collection cleared");
      fetchUserDetail(userId);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleUserGrantCards = async (userId: string) => {
    try {
      const res = await adminFetch("user_grant", { userId, count: grantCardCount, setId: selectedSetFilter });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Granted ${data.grantedCount} cards!`);
      fetchUserDetail(userId);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  // ─── Pack action handlers ─────────────────────────────────────────────────
  const handlePackUpdate = async (setId: string, pack_enabled: boolean, featured_pack: boolean) => {
    try {
      const res = await adminFetch("pack_update", { setId, pack_enabled, featured_pack });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Pack settings saved");
      fetchPacks();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleDisableAllPacks = async () => {
    if (!confirm("Are you sure you want to disable ALL booster packs? Players will not be able to buy or open any packs.")) return;
    try {
      const res = await adminFetch("pack_disable_all");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Disabled all booster packs successfully");
      fetchPacks();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEnableAllPacks = async () => {
    if (!confirm("Are you sure you want to enable ALL booster packs? Players will be able to buy and open all packs.")) return;
    try {
      const res = await adminFetch("pack_enable_all");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Enabled all booster packs successfully");
      fetchPacks();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  // ─── Event handlers ───────────────────────────────────────────────────────
  const handleEventSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name") as string,
      description: fd.get("description") as string,
      start_date: new Date(fd.get("start_date") as string).toISOString(),
      end_date: new Date(fd.get("end_date") as string).toISOString(),
      bonus_drop_rate: parseFloat(fd.get("bonus_drop_rate") as string) || 1.0,
    };
    try {
      if (editingEvent) {
        const res = await adminFetch("event_update", { eventId: editingEvent.id, ...payload, is_active: editingEvent.is_active });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast("Event updated");
      } else {
        const res = await adminFetch("event_create", payload);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast("Event created!");
      }
      setEditingEvent(null);
      setEventForm(null);
      fetchEvents();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEventDelete = async (eventId: string) => {
    if (!confirm("Delete this event pack?")) return;
    try {
      const res = await adminFetch("event_delete", { eventId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Event deleted");
      fetchEvents();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleToggleEventActive = async (event: any) => {
    try {
      const res = await adminFetch("event_update", { eventId: event.id, is_active: !event.is_active });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(event.is_active ? "Event disabled" : "Event activated");
      fetchEvents();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  // ─── Card handlers ────────────────────────────────────────────────────────
  const handleToggleCardHide = async (card: any) => {
    const action = card.hidden ? "card_unhide" : "card_hide";
    try {
      const res = await adminFetch(action, { cardId: card.id });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(card.hidden ? "Card unhidden" : "Card hidden from players");
      fetchCards();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleSimulatePacks = async (setId: string) => {
    setSimulating(true);
    try {
      const res = await adminFetch("simulate_packs", { setId });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSimResults(data.distribution || []);
      showToast(`Simulated ${data.totalSimulatedPulls.toLocaleString()} pulls!`);
    } catch (err: any) { showToast(err.message, "error"); }
    finally { setSimulating(false); }
  };

  const exportCSV = () => {
    let csv = "Username,FID,PacksOpened,PackTickets,LoginStreak,TotalCards,IsBanned\n";
    users.forEach(u => {
      csv += `"${u.username}","${u.fid}","${u.packs_opened}","${u.pack_tickets}","${u.login_streak}","${u.totalCards}","${u.is_banned}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokecast_users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("CSV exported");
  };

  // ─── Login Gate ───────────────────────────────────────────────────────────
  if (isAdminAuthorized === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-dotted border-[#F4B9B0] border-t-transparent rounded-none animate-spin" />
      </div>
    );
  }

  if (isAdminAuthorized === false) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden pacman-theme">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
          .pacman-theme {
            font-family: 'Press Start 2P', monospace !important;
            background-color: #000000 !important;
            color: #ffffff !important;
          }
          .pacman-theme input {
            font-family: 'Space Mono', monospace !important;
            font-size: 11px !important;
            background-color: #000000 !important;
            border: 2px dotted #2A3FE5 !important;
            color: #ffffff !important;
            border-radius: 0px !important;
            padding: 8px 12px !important;
          }
          .pacman-theme input:focus {
            border: 2px solid #F4B9B0 !important;
            outline: none !important;
          }
          .pacman-theme button {
            font-family: 'Press Start 2P', monospace !important;
            text-transform: uppercase;
            border-radius: 0px !important;
          }
          .pacman-mono {
            font-family: 'Space Mono', monospace !important;
          }
        `}</style>
        <div className="w-full max-w-sm bg-black border-4 border-dotted border-[#2A3FE5] p-8 shadow-[6px_6px_0px_rgba(255,255,255,0.15)] space-y-6 relative z-10 rounded-none">
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 border-2 border-dotted border-[#F4B9B0] text-[#F4B9B0] flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-sm font-black tracking-wider text-white uppercase">PokéCast Admin</h1>
            <p className="text-[9px] text-zinc-500 uppercase font-mono pacman-mono">Restricted access — authorized personnel only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Admin Password</label>
              <input
                type="password"
                placeholder="Enter password..."
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full h-10 bg-black border-2 border-dotted border-[#2A3FE5] text-center text-xs tracking-wider text-white focus:outline-none"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-[9px] text-[#DC2626] text-center bg-black border border-dotted border-[#DC2626] p-2.5 rounded-none pacman-mono">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loginLoading || !adminPassword}
              className="w-full h-11 bg-black border-2 border-dotted border-[#F4B9B0] hover:bg-[#F4B9B0] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed text-[#F4B9B0] font-bold rounded-none transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loginLoading ? <div className="w-4 h-4 border-2 border-[#F4B9B0] border-t-transparent rounded-none animate-spin" /> : <Lock className="w-4 h-4" />}
              {loginLoading ? "Authenticating..." : "Access Admin Panel"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Tab config ───────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" />, badge: stats?.totalUsers },
    { id: "quests", label: "Quests", icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: "packs", label: "Packs", icon: <Package className="w-4 h-4" /> },
    { id: "events", label: "Events", icon: <Calendar className="w-4 h-4" /> },
    { id: "cards", label: "Cards", icon: <Layers className="w-4 h-4" /> },
    { id: "market", label: "Market", icon: <ShieldAlert className="w-4 h-4" />, badge: marketStats?.unresolvedReports || undefined },
    { id: "logs", label: "Live Logs", icon: <Activity className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "audit", label: "Audit Log", icon: <Clock className="w-4 h-4" /> },
  ];

  // ─── MAIN ADMIN PANEL ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white pacman-theme selection:bg-[#F4B9B0] selection:text-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        
        /* Apply fonts globally */
        .pacman-theme {
          font-family: 'Press Start 2P', monospace !important;
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        
        .pacman-mono {
          font-family: 'Space Mono', monospace !important;
        }
        
        /* Form elements styles */
        .pacman-theme input, .pacman-theme select, .pacman-theme textarea {
          font-family: 'Space Mono', monospace !important;
          font-size: 11px !important;
          background-color: #000000 !important;
          border: 2px dotted #2A3FE5 !important;
          color: #ffffff !important;
          border-radius: 0px !important;
          padding: 8px 12px !important;
          transition: all 0.2s ease-in-out;
        }
        .pacman-theme input:focus, .pacman-theme select:focus, .pacman-theme textarea:focus {
          border: 2px solid #F4B9B0 !important;
          outline: none !important;
          box-shadow: 0 0 8px rgba(244, 185, 176, 0.4);
        }
        
        /* Custom buttons */
        .pacman-theme button {
          font-family: 'Press Start 2P', monospace !important;
          text-transform: uppercase;
          transition: all 0.15s ease-in-out;
          border-radius: 0px !important;
        }
        .pacman-theme button:active {
          transform: translate(2px, 2px);
        }
        
        /* Dotted outlines */
        .pacman-border-dotted {
          border: 4px dotted #2A3FE5 !important;
        }
        
        /* Scrollbar styles */
        .pacman-theme ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .pacman-theme ::-webkit-scrollbar-track {
          background: #000000;
          border: 2px dotted #2A3FE5;
        }
        .pacman-theme ::-webkit-scrollbar-thumb {
          background: #F4B9B0;
          border-radius: 0px;
        }
        .pacman-theme ::-webkit-scrollbar-thumb:hover {
          background: #2A3FE5;
        }
      `}</style>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b-4 border-dotted border-zinc-800 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 border-2 border-dotted border-[#F4B9B0] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#F4B9B0]" />
            </div>
            <span className="font-black text-xs tracking-wider text-white hidden sm:block uppercase">PokéCast Admin</span>
          </div>

          {/* Tab Navigation (desktop) */}
          <nav className="hidden lg:flex items-center gap-2 overflow-x-auto pacman-mono">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-[#2A3FE5] text-white border-2 border-double border-[#F4B9B0]" : "bg-black text-zinc-400 hover:text-white border-2 border-dotted border-zinc-800"}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 pacman-mono">
            <button
              onClick={() => { fetchStats(); showToast("Stats refreshed", "info"); }}
              className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none"
              title="Refresh stats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 border-2 border-dotted border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-all text-[9px] font-bold rounded-none"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex items-center gap-2 px-4 pb-2 overflow-x-auto pacman-mono">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[9px] uppercase whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-[#2A3FE5] text-white border border-solid border-[#F4B9B0] rounded-none" : "bg-black text-zinc-550 border border-dotted border-zinc-800 rounded-none"}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Admin Dashboard</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">System overview & live metrics</p>
              </div>
              {stats && (
                <div className="flex items-center gap-2 pacman-mono">
                  <div className={`w-3.5 h-3.5 border border-solid border-white ${stats.databaseStatus === "Healthy" ? "bg-[#16A34A] animate-pulse" : "bg-[#DC2626]"}`} />
                  <span className="text-[9px] uppercase tracking-wider text-white">{stats.databaseStatus} · {stats.databaseLatencyMs}ms</span>
                </div>
              )}
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} className="h-24 bg-black border-2 border-dotted border-[#2A3FE5] animate-pulse rounded-none" />
                ))}
              </div>
            ) : stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={stats.totalUsers} sub="All-time registrations" />
                <StatCard icon={<Activity className="w-5 h-5" />} label="Daily Active" value={stats.dailyActiveUsers} sub="Last 24 hours" accent="bg-black text-[#16A34A] border-[#16A34A]" />
                <StatCard icon={<Sparkles className="w-5 h-5" />} label="New Today" value={stats.newUsersToday} sub="New signups today" accent="bg-black text-[#F4B9B0] border-[#F4B9B0]" />
                <StatCard icon={<Layers className="w-5 h-5" />} label="Cards Owned" value={stats.totalCardsClaimed} sub="Total across all users" accent="bg-black text-[#2A3FE5] border-[#2A3FE5]" />
                <StatCard icon={<Package className="w-5 h-5" />} label="Packs Opened" value={stats.totalPacksOpened} sub="All-time pack opens" accent="bg-black text-[#D97706] border-[#D97706]" />
                <StatCard icon={<Heart className="w-5 h-5" />} label="Wishlist Entries" value={stats.totalWishlists} sub="Cards being wished for" accent="bg-black text-[#DC2626] border-[#DC2626]" />
                <StatCard icon={<RefreshCw className="w-5 h-5" />} label="Trade Offers" value={stats.totalTrades} sub="All-time trade attempts" accent="bg-black text-white border-white" />
                <StatCard icon={<Database className="w-5 h-5" />} label="Card DB" value={stats.totalAvailableCards} sub={`Across ${stats.totalAvailableSets} sets`} />
              </div>
            )}

            {/* Quick actions */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Manage Users", desc: "Search, ban, & ticket management", tab: "users" as Tab, icon: <Users className="w-4 h-4" /> },
                { label: "Pack Settings", desc: "Enable/disable & feature packs", tab: "packs" as Tab, icon: <Package className="w-4 h-4" /> },
                { label: "Create Event", desc: "Launch limited-time events", tab: "events" as Tab, icon: <Calendar className="w-4 h-4" /> },
                { label: "View Analytics", desc: "DAU trends & top cards", tab: "analytics" as Tab, icon: <TrendingUp className="w-4 h-4" /> },
              ].map((qa) => (
                <button
                  key={qa.tab}
                  onClick={() => setActiveTab(qa.tab)}
                  className="bg-black border-4 border-dotted border-[#2A3FE5] hover:border-[#F4B9B0] p-4 text-left transition-all rounded-none shadow-[4px_4px_0px_rgba(255,255,255,0.15)] group active:translate-y-[2px] active:translate-x-[2px]"
                >
                  <div className="w-10 h-10 border border-dotted border-[#2A3FE5] flex items-center justify-center mb-3 text-white bg-black shrink-0 group-hover:border-[#F4B9B0] transition-colors">
                    {qa.icon}
                  </div>
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-1">{qa.label}</p>
                  <p className="text-[9px] text-[#F4B9B0] pacman-mono uppercase leading-tight">{qa.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS TAB ────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">User Management</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">{users.length} trainers loaded</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-black border-2 border-dotted border-[#2A3FE5] hover:border-[#F4B9B0] hover:bg-black text-white text-[9px] font-bold transition-all rounded-none uppercase">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2A3FE5]" />
              <input
                type="text"
                placeholder="Search by username or FID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none text-xs text-white placeholder-zinc-700 focus:border-[#F4B9B0] focus:outline-none"
              />
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              {/* User List */}
              <div className="lg:col-span-2 space-y-2">
                {loadingUsers ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-16 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />
                  ))
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-[10px] uppercase pacman-mono border-2 border-dotted border-[#2A3FE5]">No trainers found</div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => fetchUserDetail(user.id)}
                      className={`w-full flex items-center gap-3 p-3 border-2 transition-all text-left rounded-none ${selectedUser?.id === user.id ? "bg-[#2A3FE5]/10 border-solid border-[#F4B9B0]" : "bg-black border-dotted border-[#2A3FE5] hover:border-[#F4B9B0]"}`}
                    >
                      <div className="w-10 h-10 border border-dotted border-[#2A3FE5] overflow-hidden bg-black shrink-0 rounded-none flex items-center justify-center">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-none" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">{user.username?.[0]?.toUpperCase() || "?"}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{user.username || `FID ${user.fid}`}</span>
                          {user.is_admin && <Badge color="fuchsia">Admin</Badge>}
                          {user.is_banned && <Badge color="rose">Banned</Badge>}
                          {user.is_hidden && <Badge color="amber">Hidden</Badge>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[8px] text-[#F4B9B0] pacman-mono uppercase">
                          <span>FID {user.fid}</span>
                          <span>·</span>
                          <span>{user.totalCards} cards</span>
                          <span>·</span>
                          <span>🎟 {user.pack_tickets}</span>
                          <span>·</span>
                          <span>✨ {user.pokepoints || 0}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* User Detail Panel */}
              <div className="lg:col-span-3">
                {!selectedUser ? (
                  <div className="h-full min-h-[250px] flex items-center justify-center bg-black border-4 border-dotted border-[#2A3FE5] rounded-none p-6">
                    <div className="text-center space-y-2">
                      <UserCheck className="w-8 h-8 text-[#2A3FE5] mx-auto" />
                      <p className="text-[9px] uppercase tracking-wider text-[#F4B9B0] pacman-mono">Select a trainer to view details</p>
                    </div>
                  </div>
                ) : loadingUserDetail ? (
                  <div className="h-64 bg-black border-4 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />
                ) : (
                  <div className="bg-black border-4 border-double border-[#F4B9B0] p-5 space-y-5 rounded-none shadow-[4px_4px_0px_rgba(255,255,255,0.15)]">
                    {/* Profile header */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 border-2 border-dotted border-[#2A3FE5] bg-black shrink-0 rounded-none overflow-hidden flex items-center justify-center">
                        {selectedUser.avatar ? (
                          <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover rounded-none" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{selectedUser.username?.[0]?.toUpperCase()}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-black text-white uppercase tracking-wider">{selectedUser.username}</h3>
                          {selectedUser.is_admin && <Badge color="fuchsia">Admin</Badge>}
                          {selectedUser.is_banned && <Badge color="rose">Banned</Badge>}
                          {selectedUser.is_hidden && <Badge color="amber">Hidden</Badge>}
                        </div>
                        <p className="text-[8px] text-zinc-500 mt-1 pacman-mono uppercase">FID {selectedUser.fid} · Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Pack Tickets", value: selectedUser.pack_tickets || 0, icon: "🎟" },
                        { label: "PokePoints", value: selectedUser.pokepoints || 0, icon: "✨" },
                        { label: "Lifetime Pts", value: selectedUser.lifetime_points || 0, icon: "💎" },
                        { label: "Packs Opened", value: selectedUser.packs_opened || 0, icon: "📦" },
                        { label: "Login Streak", value: selectedUser.login_streak || 0, icon: "🔥" },
                        { label: "Total Cards", value: selectedUserCards.length, icon: "🃏" },
                      ].map((s) => (
                        <div key={s.label} className="bg-black border-2 border-dotted border-[#2A3FE5] p-2 text-center rounded-none">
                          <div className="text-sm mb-0.5">{s.icon}</div>
                          <div className="text-[10px] font-black text-white">{s.value.toLocaleString()}</div>
                          <div className="text-[8px] text-[#F4B9B0] uppercase tracking-wider pacman-mono mt-1 leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Ticket management */}
                    <div className="space-y-2">
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Ticket Management</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={ticketAmount}
                          onChange={(e) => setTicketAmount(Number(e.target.value))}
                          className="w-20 h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-2 text-xs text-white text-center focus:outline-none"
                        />
                        <button onClick={() => handleAddTickets(selectedUser.id)} className="flex-1 h-9 bg-black hover:bg-[#16A34A] hover:text-white text-[#16A34A] border-2 border-dotted border-[#16A34A] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                        <button onClick={() => handleRemoveTickets(selectedUser.id)} className="flex-1 h-9 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1">
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>

                    {/* PokePoints Management */}
                    <div className="space-y-2">
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">PokePoints Management</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99999}
                          value={pointsAmount}
                          onChange={(e) => setPointsAmount(Number(e.target.value))}
                          className="w-20 h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-2 text-xs text-white text-center focus:outline-none"
                        />
                        <button onClick={() => handleAddPoints(selectedUser.id)} className="flex-1 h-9 bg-black hover:bg-[#2A3FE5] hover:text-white text-[#2A3FE5] border-2 border-dotted border-[#2A3FE5] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Points
                        </button>
                        <button onClick={() => handleRemovePoints(selectedUser.id)} className="flex-1 h-9 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1">
                          <X className="w-3.5 h-3.5" /> Remove Points
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Reason for points adjustment (optional)..."
                        value={pointsReason}
                        onChange={(e) => setPointsReason(e.target.value)}
                        className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white placeholder-zinc-700 focus:outline-none"
                      />
                    </div>

                    {/* Grant cards */}
                    <div className="space-y-2">
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Grant Cards</p>
                      <div className="flex gap-2">
                        <input type="number" min={1} max={100} value={grantCardCount} onChange={(e) => setGrantCardCount(Number(e.target.value))}
                          className="w-20 h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-2 text-xs text-white text-center focus:outline-none" />
                        <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                          className="flex-1 h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-2 text-xs text-white focus:outline-none min-w-0">
                          {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={() => handleUserGrantCards(selectedUser.id)}
                          className="h-9 px-3 bg-black hover:bg-[#2A3FE5] hover:text-white text-[#2A3FE5] border-2 border-dotted border-[#2A3FE5] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Grant
                        </button>
                      </div>
                    </div>

                    {/* Ban reason */}
                    {!selectedUser.is_banned && (
                      <input type="text" placeholder="Ban reason (optional)..." value={banReason} onChange={(e) => setBanReason(e.target.value)}
                        className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white placeholder-zinc-700 focus:outline-none" />
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {selectedUser.is_banned ? (
                        <button onClick={() => handleUnbanUser(selectedUser.id)}
                          className="sm:col-span-2 h-9 bg-black hover:bg-[#16A34A] hover:text-white text-[#16A34A] border-2 border-dotted border-[#16A34A] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Unban User
                        </button>
                      ) : (
                        <button onClick={() => handleBanUser(selectedUser.id)}
                          className="h-9 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                          <Ban className="w-3.5 h-3.5" /> Ban
                        </button>
                      )}
                      {selectedUser.is_hidden ? (
                        <button onClick={() => handleUnhideUser(selectedUser.id)}
                          className="h-9 bg-black hover:bg-[#16A34A] hover:text-white text-[#16A34A] border-2 border-dotted border-[#16A34A] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Show to Public
                        </button>
                      ) : (
                        <button onClick={() => handleHideUser(selectedUser.id)}
                          className="h-9 bg-black hover:bg-[#D97706] hover:text-white text-[#D97706] border-2 border-dotted border-[#D97706] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5" /> Hide from Public
                        </button>
                      )}
                      <button onClick={() => handleToggleAdmin(selectedUser.id)}
                        className={`h-9 border-2 border-dotted text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5 rounded-none ${
                          selectedUser.is_admin 
                            ? "bg-black hover:bg-[#F4B9B0] hover:text-black text-[#F4B9B0] border-[#F4B9B0] hover:border-solid" 
                            : "bg-black hover:bg-white hover:text-black text-zinc-400 border-zinc-700 hover:border-solid"
                        }`}>
                        <ShieldAlert className="w-3.5 h-3.5" /> {selectedUser.is_admin ? "Revoke Admin" : "Make Admin"}
                      </button>
                      <button onClick={() => handleResetStreak(selectedUser.id)}
                        className="h-9 bg-black hover:bg-[#D97706] hover:text-white text-[#D97706] border-2 border-dotted border-[#D97706] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Streak
                      </button>
                      <button onClick={() => handleUserClearCollection(selectedUser.id)}
                        className="h-9 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Clear Cards
                      </button>
                      <button onClick={() => handleUserDelete(selectedUser.id)}
                        className="sm:col-span-2 h-9 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-4 border-double border-[#DC2626] rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Account Permanently
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── QUESTS TAB ───────────────────────────────────────────────── */}
        {activeTab === "quests" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Quest Management</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Adjust quest requirements, ticket rewards, and link associations dynamically</p>
              </div>
              <button onClick={fetchQuests} className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quest Edit Form */}
            {editingQuest && (
              <form onSubmit={handleQuestSave} className="bg-black border-4 border-double border-[#F4B9B0] p-5 space-y-4 rounded-none shadow-[6px_6px_0px_rgba(255,255,255,0.15)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-white uppercase tracking-wider">Edit Quest ({editingQuest.id})</h3>
                  <button type="button" onClick={() => setEditingQuest(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Title *</label>
                    <input name="title" required defaultValue={editingQuest.title}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Target *</label>
                    <input name="target" type="number" required min="1" defaultValue={editingQuest.target}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Reward Tickets *</label>
                    <input name="reward" type="number" required min="1" defaultValue={editingQuest.reward}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Link (Warpcast/Social URL)</label>
                    <input name="link" defaultValue={editingQuest.link || ""} placeholder="https://..."
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Description</label>
                    <textarea name="description" defaultValue={editingQuest.description} rows={2} placeholder="Quest instructions..."
                      className="w-full bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 py-2 text-xs text-white resize-none focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditingQuest(null)}
                    className="h-9 px-4 border-2 border-dotted border-zinc-700 text-zinc-550 hover:text-white hover:border-white rounded-none text-[8px] font-bold uppercase transition-all">Cancel</button>
                  <button type="submit" className="h-9 px-4 bg-black hover:bg-[#F4B9B0] hover:text-black text-[#F4B9B0] border-2 border-dotted border-[#F4B9B0] rounded-none text-[8px] font-bold transition-all uppercase flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Save Quest
                  </button>
                </div>
              </form>
            )}

            {loadingQuests ? (
              <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : questsList.length === 0 ? (
              <div className="text-center py-16 space-y-3 border-2 border-dotted border-[#2A3FE5]">
                <FileSpreadsheet className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-[9px] text-zinc-500 uppercase pacman-mono">No quests found. Dynamic quests definitions will load when Supabase is seeded.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Daily Quests Category */}
                <div className="space-y-3">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#F4B9B0] border-b-2 border-dotted border-[#2A3FE5] pb-2">Daily Quests</h2>
                  {questsList.filter(q => !q.is_main).map((quest) => (
                    <div key={quest.id} className="bg-black border-2 border-dotted border-[#2A3FE5] hover:border-[#F4B9B0] p-4 flex flex-col justify-between gap-3 rounded-none transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">{quest.title}</span>
                          <span className="text-[8px] font-mono text-zinc-500 pacman-mono">{quest.id}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 pacman-mono leading-tight">{quest.description || "No description."}</p>
                        <div className="flex gap-2 items-center text-[8px] text-[#F4B9B0] pacman-mono uppercase pt-1 flex-wrap">
                          <span>Target: <strong className="text-white">{quest.target}</strong></span>
                          <span>·</span>
                          <span className="text-[#D97706] font-semibold">Reward: {quest.reward} Tickets</span>
                        </div>
                      </div>
                      <button onClick={() => { setEditingQuest(quest); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="w-full h-8 bg-black hover:bg-[#2A3FE5] hover:text-white text-[#2A3FE5] border-2 border-dotted border-[#2A3FE5] rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" /> Edit Quest
                      </button>
                    </div>
                  ))}
                </div>

                {/* Main Quests Category */}
                <div className="space-y-3">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#F4B9B0] border-b-2 border-dotted border-[#2A3FE5] pb-2">Main Quests (One-time)</h2>
                  {questsList.filter(q => q.is_main).map((quest) => (
                    <div key={quest.id} className="bg-black border-2 border-dotted border-[#2A3FE5] hover:border-[#F4B9B0] p-4 flex flex-col justify-between gap-3 rounded-none transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">{quest.title}</span>
                          <span className="text-[8px] font-mono text-zinc-500 pacman-mono">{quest.id}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 pacman-mono leading-tight">{quest.description || "No description."}</p>
                        {quest.link && (
                          <p className="text-[8px] text-[#2A3FE5] truncate pacman-mono uppercase">Link: {quest.link}</p>
                        )}
                        <div className="flex gap-2 items-center text-[8px] text-[#F4B9B0] pacman-mono uppercase pt-1 flex-wrap">
                          <span>Target: <strong className="text-white">{quest.target}</strong></span>
                          <span>·</span>
                          <span className="text-[#D97706] font-semibold">Reward: {quest.reward} Tickets</span>
                        </div>
                      </div>
                      <button onClick={() => { setEditingQuest(quest); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="w-full h-8 bg-black hover:bg-[#2A3FE5] hover:text-white text-[#2A3FE5] border-2 border-dotted border-[#2A3FE5] rounded-none text-[8px] font-bold transition-all uppercase flex items-center justify-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" /> Edit Quest
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PACKS TAB ────────────────────────────────────────────────── */}
        {activeTab === "packs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Pack Management</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Enable, disable, and feature expansion packs</p>
              </div>
            </div>

            {/* Search and Global Action Row (At the very top) */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2A3FE5]" />
                <input
                  type="text"
                  placeholder="Search pack by name or ID..."
                  value={packSearch}
                  onChange={(e) => setPackSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none text-xs text-white placeholder-zinc-700 focus:border-[#F4B9B0] focus:outline-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleEnableAllPacks}
                  className="px-3 h-10 bg-black hover:bg-[#16A34A] hover:text-white text-[#16A34A] border-2 border-dotted border-[#16A34A] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Enable All Packs
                </button>
                <button
                  onClick={handleDisableAllPacks}
                  className="px-3 h-10 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none text-[8px] font-bold transition-all uppercase flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" /> Disable All Packs
                </button>
                <button onClick={fetchPacks} className="w-10 h-10 flex items-center justify-center bg-black border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingPacks ? (
              <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {packs
                  .filter((p) => 
                    p.name.toLowerCase().includes(packSearch.toLowerCase()) || 
                    p.id.toLowerCase().includes(packSearch.toLowerCase())
                  )
                  .map((pack) => (
                  <div key={pack.id} className={`flex items-center gap-3 p-3 border-2 transition-all rounded-none ${pack.pack_enabled ? "bg-black border-dotted border-[#2A3FE5]" : "bg-black border-dotted border-zinc-850 opacity-60"}`}>
                    {pack.logo && (
                      <img src={pack.logo} alt={pack.name} className="w-10 h-10 object-contain rounded-none border border-dotted border-[#2A3FE5] bg-black p-1 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{pack.name}</span>
                        {pack.featured_pack && <Badge color="amber">⭐ Featured</Badge>}
                        {!pack.pack_enabled && <Badge color="rose">Disabled</Badge>}
                      </div>
                      <p className="text-[8px] text-[#F4B9B0] mt-1 pacman-mono uppercase leading-none">{pack.series || "—"} · {pack.id}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Featured toggle */}
                      <button
                        onClick={() => handlePackUpdate(pack.id, pack.pack_enabled, !pack.featured_pack)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-none text-[8px] font-bold uppercase transition-all border-2 ${pack.featured_pack ? "bg-black border-double border-[#D97706] text-[#D97706]" : "bg-black border-dotted border-zinc-800 text-zinc-550 hover:border-[#D97706] hover:text-[#D97706]"}`}
                      >
                        <Star className="w-3 h-3" /> {pack.featured_pack ? "Featured" : "Feature"}
                      </button>
                      {/* Enable/Disable toggle */}
                      <button
                        onClick={() => handlePackUpdate(pack.id, !pack.pack_enabled, pack.featured_pack)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-none text-[8px] font-bold uppercase transition-all border-2 ${pack.pack_enabled ? "bg-black border-double border-[#16A34A] text-[#16A34A] hover:border-[#DC2626] hover:text-[#DC2626]" : "bg-black border-dotted border-[#DC2626] text-[#DC2626] hover:border-[#16A34A] hover:text-[#16A34A]"}`}
                      >
                        {pack.pack_enabled ? "Enabled" : "Enable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pack Simulator */}
            <div className="bg-black border-4 border-dotted border-[#2A3FE5] p-4 space-y-3 rounded-none">
              <SectionHeader title="Pack Pull Simulator" />
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                  className="flex-1 h-9 bg-black border-2 border-dotted border-[#2A3FE5] px-3 text-xs text-white focus:outline-none rounded-none">
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => handleSimulatePacks(selectedSetFilter)} disabled={simulating}
                  className="flex items-center justify-center gap-1.5 px-4 h-9 bg-black hover:bg-[#F4B9B0] hover:text-black text-[#F4B9B0] border-2 border-dotted border-[#F4B9B0] disabled:opacity-40 rounded-none text-[8px] font-bold uppercase transition-all shrink-0">
                  {simulating ? <div className="w-3.5 h-3.5 border-2 border-[#F4B9B0] border-t-transparent rounded-none animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                  Simulate 5,000 Pulls
                </button>
              </div>
              {simResults.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  {simResults.sort((a, b) => b.count - a.count).map((r) => (
                    <div key={r.rarity} className="flex items-center gap-2">
                      <div className="w-32 text-[8px] text-zinc-500 font-bold uppercase pacman-mono truncate">{r.rarity}</div>
                      <div className="flex-1 h-5 bg-black border border-dotted border-[#2A3FE5] rounded-none overflow-hidden relative">
                        <div className="h-full bg-[#2A3FE5] border-r-2 border-solid border-[#F4B9B0] transition-all" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <div className="w-10 text-[8px] text-[#F4B9B0] font-mono text-right pacman-mono">{r.percentage}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EVENTS TAB ───────────────────────────────────────────────── */}
        {activeTab === "events" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Event Management</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Create and manage limited-time event packs</p>
              </div>
              <button onClick={() => { setEditingEvent(null); setEventForm(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-black hover:bg-[#F4B9B0] hover:text-black text-[#F4B9B0] border-2 border-dotted border-[#F4B9B0] rounded-none text-[8px] font-bold uppercase transition-all">
                <Plus className="w-3.5 h-3.5" /> New Event
              </button>
            </div>

            {/* Event Create/Edit Form */}
            {eventForm && (
              <form onSubmit={handleEventSave} className="bg-black border-4 border-double border-[#F4B9B0] p-5 space-y-4 rounded-none shadow-[6px_6px_0px_rgba(255,255,255,0.15)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-white uppercase tracking-wider">{editingEvent ? "Edit Event" : "Create New Event"}</h3>
                  <button type="button" onClick={() => { setEventForm(null); setEditingEvent(null); }} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Event Name *</label>
                    <input name="name" required defaultValue={editingEvent?.name} placeholder="e.g. Summer Festival Event"
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Bonus Drop Rate (×)</label>
                    <input name="bonus_drop_rate" type="number" min="0.1" max="10" step="0.1" defaultValue={editingEvent?.bonus_drop_rate || 1.0}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Start Date *</label>
                    <input name="start_date" type="datetime-local" required defaultValue={editingEvent?.start_date?.slice(0, 16)}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">End Date *</label>
                    <input name="end_date" type="datetime-local" required defaultValue={editingEvent?.end_date?.slice(0, 16)}
                      className="w-full h-9 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] pacman-mono">Description</label>
                    <textarea name="description" defaultValue={editingEvent?.description} rows={2} placeholder="Optional event description..."
                      className="w-full bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 py-2 text-xs text-white resize-none focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setEventForm(null); setEditingEvent(null); }}
                    className="h-9 px-4 border-2 border-dotted border-zinc-700 text-zinc-550 hover:text-white hover:border-white rounded-none text-[8px] font-bold uppercase transition-all">Cancel</button>
                  <button type="submit" className="h-9 px-4 bg-black hover:bg-[#F4B9B0] hover:text-black text-[#F4B9B0] border-2 border-dotted border-[#F4B9B0] rounded-none text-[8px] font-bold transition-all uppercase flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </form>
            )}

            {loadingEvents ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 space-y-3 border-2 border-dotted border-[#2A3FE5]">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-[9px] text-zinc-500 uppercase pacman-mono">No events yet. Create your first event pack!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const now = new Date();
                  const isLive = ev.is_active && new Date(ev.start_date) <= now && new Date(ev.end_date) >= now;
                  const isExpired = new Date(ev.end_date) < now;
                  return (
                    <div key={ev.id} className={`bg-black border-2 p-4 transition-all rounded-none ${isLive ? "border-solid border-[#16A34A]" : isExpired ? "border-dotted border-zinc-850 opacity-50" : "border-dotted border-[#2A3FE5]"}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{ev.name}</span>
                            {isLive && <Badge color="emerald">🟢 Live</Badge>}
                            {isExpired && <Badge color="zinc">Expired</Badge>}
                            {!ev.is_active && !isExpired && <Badge color="zinc">Disabled</Badge>}
                            <Badge color="sky">{ev.bonus_drop_rate}× Drop Rate</Badge>
                          </div>
                          {ev.description && <p className="text-[9px] text-zinc-500 mt-1.5 pacman-mono uppercase leading-tight">{ev.description}</p>}
                          <p className="text-[8px] text-[#F4B9B0] mt-1.5 pacman-mono uppercase">
                            {new Date(ev.start_date).toLocaleString()} → {new Date(ev.end_date).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => { setEditingEvent(ev); setEventForm(true); }}
                            className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-[#2A3FE5] text-[#2A3FE5] hover:border-[#F4B9B0] hover:text-[#F4B9B0] rounded-none transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleEventActive(ev)}
                            className={`w-8 h-8 flex items-center justify-center border-2 border-dotted rounded-none transition-colors ${ev.is_active ? "border-[#16A34A] text-[#16A34A] hover:border-[#DC2626] hover:text-[#DC2626]" : "border-zinc-800 text-zinc-550 hover:border-[#16A34A] hover:text-[#16A34A]"}`}>
                            {ev.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleEventDelete(ev.id)}
                            className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626] hover:text-white rounded-none transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CARDS TAB ────────────────────────────────────────────────── */}
        {activeTab === "cards" && (
          <div className="space-y-4">
            <div className="pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Card Management</h1>
              <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Hide or unhide cards from player packs</p>
            </div>

            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2A3FE5]" />
                <input type="text" placeholder="Search cards..." value={cardSearch} onChange={(e) => setCardSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none text-xs text-white focus:outline-none" />
              </div>
              <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                className="h-10 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none max-w-[180px]">
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {loadingCards ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {Array(10).fill(0).map((_, i) => <div key={i} className="aspect-[3/4] bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-16 text-zinc-550 border-2 border-dotted border-[#2A3FE5] text-[9px] uppercase pacman-mono">No cards found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {cards.map((card) => (
                  <div key={card.id} className={`group relative bg-black border-2 overflow-hidden transition-all rounded-none ${card.hidden ? "border-dotted border-[#DC2626] opacity-40" : "border-dotted border-[#2A3FE5] hover:border-[#F4B9B0]"}`}>
                    <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center p-2">
                      <img src={card.image || card.imageUrl} alt={card.name}
                        className={`w-full h-full object-contain transition-all ${card.hidden ? "grayscale" : ""}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.pokemontcg.io/base1/1.png"; }} />
                      {card.hidden && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/75 rounded-none">
                          <EyeOff className="w-6 h-6 text-[#DC2626]" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-1 bg-black border-t border-dotted border-[#2A3FE5]">
                      <p className="text-[8px] font-bold text-white uppercase tracking-wider truncate">{card.name}</p>
                      <p className="text-[8px] text-[#F4B9B0] pacman-mono uppercase truncate">{card.rarity || "—"}</p>
                    </div>
                    <button onClick={() => handleToggleCardHide(card)}
                      className={`absolute top-2 right-2 w-8 h-8 rounded-none border-2 border-dotted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${card.hidden ? "bg-black border-[#16A34A] text-[#16A34A]" : "bg-black border-[#DC2626] text-[#DC2626]"}`}>
                      {card.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ────────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Analytics</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Game activity and engagement metrics</p>
              </div>
              <button onClick={fetchAnalytics} className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : analytics ? (
              <>
                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard icon={<Users className="w-5 h-5" />} label="New Today" value={analytics.newUsersToday} accent="bg-black text-[#F4B9B0] border-[#F4B9B0]" />
                  <StatCard icon={<Package className="w-5 h-5" />} label="Rewards Today" value={analytics.packsOpenedToday} accent="bg-black text-[#D97706] border-[#D97706]" />
                  {analytics.mostOpenedPack && (
                    <StatCard icon={<Trophy className="w-5 h-5" />} label="Top Pack" value={analytics.mostOpenedPack.name} sub={`${analytics.mostOpenedPack.count.toLocaleString()} cards pulled`} accent="bg-black text-white border-white" />
                  )}
                </div>

                {/* DAU Chart */}
                <div className="bg-black border-4 border-dotted border-[#2A3FE5] p-4 rounded-none">
                  <SectionHeader title="Daily Active Users (Last 7 Days)" />
                  <BarChart data={analytics.dauData} />
                </div>

                {/* Top cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {analytics.mostCollectedCard?.card && (
                    <div className="bg-black border-2 border-dotted border-[#2A3FE5] p-4 rounded-none">
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] mb-3 pacman-mono">Most Collected Card</p>
                      <div className="flex items-center gap-3">
                        <img src={analytics.mostCollectedCard.card.image || analytics.mostCollectedCard.card.imageUrl} alt={analytics.mostCollectedCard.card.name}
                          className="w-16 h-22 object-contain border border-dotted border-[#2A3FE5] bg-black p-1 rounded-none" />
                        <div>
                          <p className="text-[9px] font-bold text-white uppercase tracking-wider">{analytics.mostCollectedCard.card.name}</p>
                          <p className="text-[8px] text-zinc-500 pacman-mono uppercase leading-tight">{analytics.mostCollectedCard.card.rarity}</p>
                          <p className="text-xl font-black text-[#F4B9B0] mt-1">{analytics.mostCollectedCard.count.toLocaleString()}×</p>
                          <p className="text-[8px] text-zinc-650 pacman-mono uppercase mt-1">total copies owned</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {analytics.mostWishlistedCard?.card && (
                    <div className="bg-black border-2 border-dotted border-[#2A3FE5] p-4 rounded-none">
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F4B9B0] mb-3 pacman-mono">Most Wishlisted Card</p>
                      <div className="flex items-center gap-3">
                        <img src={analytics.mostWishlistedCard.card.image || analytics.mostWishlistedCard.card.imageUrl} alt={analytics.mostWishlistedCard.card.name}
                          className="w-16 h-22 object-contain border border-dotted border-[#2A3FE5] bg-black p-1 rounded-none" />
                        <div>
                          <p className="text-[9px] font-bold text-white uppercase tracking-wider">{analytics.mostWishlistedCard.card.name}</p>
                          <p className="text-[8px] text-zinc-500 pacman-mono uppercase leading-tight">{analytics.mostWishlistedCard.card.rarity}</p>
                          <p className="text-xl font-black text-[#DC2626] mt-1">{analytics.mostWishlistedCard.count.toLocaleString()}×</p>
                          <p className="text-[8px] text-zinc-650 pacman-mono uppercase mt-1">on wishlists</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-650 text-[9px] uppercase pacman-mono border-2 border-dotted border-[#2A3FE5]">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-zinc-700 animate-pulse" />
                No analytics data yet
              </div>
            )}
          </div>
        )}

        {/* ── AUDIT LOG TAB ────────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Audit Log</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">All admin actions — persistent database record</p>
              </div>
              <button onClick={fetchAuditLogs} className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAudit ? (
              <div className="space-y-2">{Array(8).fill(0).map((_, i) => <div key={i} className="h-12 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dotted border-[#2A3FE5]">
                <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-[9px] text-zinc-500 uppercase pacman-mono">No audit logs yet. Actions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {auditLogs.map((log, i) => {
                  const actionColors: Record<string, string> = {
                    BAN_USER: "text-[#DC2626] border-[#DC2626]",
                    UNBAN_USER: "text-[#16A34A] border-[#16A34A]",
                    USER_DELETE: "text-[#DC2626] border-[#DC2626]",
                    ADD_TICKETS: "text-[#D97706] border-[#D97706]",
                    REMOVE_TICKETS: "text-[#D97706] border-[#D97706]",
                    RESET_STREAK: "text-[#2A3FE5] border-[#2A3FE5]",
                    USER_GRANT: "text-[#F4B9B0] border-[#F4B9B0]",
                    USER_CLEAR: "text-[#DC2626] border-[#DC2626]",
                    PACK_UPDATE: "text-white border-white",
                    EVENT_CREATE: "text-white border-white",
                    EVENT_UPDATE: "text-white border-white",
                    EVENT_DELETE: "text-[#DC2626] border-[#DC2626]",
                  };
                  const colorClass = actionColors[log.action] || "text-zinc-400 border-zinc-800";
                  return (
                    <div key={log.id || i} className="flex items-start gap-3 px-3 py-2.5 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none hover:border-[#F4B9B0] transition-colors flex-wrap sm:flex-nowrap">
                      <span className={`text-[8px] font-bold px-2 py-0.5 border rounded-none shrink-0 uppercase ${colorClass}`}>{log.action}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white pacman-mono uppercase leading-tight">{log.details}</p>
                        {log.admin && <p className="text-[8px] text-[#F4B9B0] pacman-mono uppercase mt-1">by {log.admin.username || "Admin"}</p>}
                      </div>
                      <span className="text-[8px] text-zinc-500 shrink-0 font-mono pacman-mono uppercase">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MARKET TAB ───────────────────────────────────────────────── */}
        {activeTab === "market" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Auction Moderation</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Review active auctions, reports, and bidding boards</p>
              </div>
              <button onClick={fetchMarketAdmin} className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Market Stats */}
            {marketStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon={<Package className="w-5 h-5" />} label="Active Auctions" value={marketStats.totalActive} accent="bg-black text-[#16A34A] border-[#16A34A]" />
                <StatCard icon={<ArrowLeftRight className="w-5 h-5" />} label="Total Bids" value={marketStats.totalBids} accent="bg-black text-[#2A3FE5] border-[#2A3FE5]" />
                <StatCard icon={<ShieldAlert className="w-5 h-5" />} label="Open Reports" value={marketStats.unresolvedReports} accent={marketStats.unresolvedReports > 0 ? "bg-black text-[#DC2626] border-[#DC2626]" : "bg-black text-zinc-550 border-zinc-800"} />
              </div>
            )}

            {/* Unresolved Reports */}
            {marketReports.length > 0 && (
              <div className="space-y-3">
                <SectionHeader title={`🚨 Pending Reports (${marketReports.length})`} />
                {marketReports.map((report: any) => (
                  <div key={report.id} className="flex items-start gap-3 p-4 bg-black border-4 border-dotted border-[#DC2626] rounded-none flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[9px] font-bold text-[#DC2626] uppercase">Reported by: {report.reporter?.username || "Unknown"}</p>
                      <p className="text-[9px] text-white pacman-mono uppercase leading-tight">Reason: {report.reason}</p>
                      {report.auction_id && <p className="text-[8px] font-mono text-zinc-555 pacman-mono uppercase">Auction ID: {report.auction_id}</p>}
                      <p className="text-[8px] text-zinc-650 pacman-mono uppercase">{new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                      {report.auction_id && (
                        <button onClick={() => handleMarketRemoveListing(report.auction_id)}
                          className="px-3 py-1.5 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] text-[8px] font-bold border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none uppercase transition-all">
                          Remove Auction
                        </button>
                      )}
                      <button onClick={() => handleMarketResolveReport(report.id)}
                        className="px-3 py-1.5 bg-black hover:bg-white hover:text-black text-zinc-400 text-[8px] font-bold border-2 border-dotted border-zinc-800 hover:border-solid rounded-none uppercase transition-all">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All Auctions */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pb-2 border-b border-dotted border-[#2A3FE5]">
                <SectionHeader title="All Auctions" />
                <input value={marketSearch} onChange={e => setMarketSearch(e.target.value)} placeholder="Filter by seller, card, or ID…"
                  className="flex-1 h-8 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none px-3 text-xs text-white focus:outline-none" />
              </div>

              {loadingMarket ? (
                <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
              ) : marketListings.length === 0 ? (
                <div className="text-center py-12 text-zinc-550 border-2 border-dotted border-[#2A3FE5] text-[9px] uppercase pacman-mono">No auctions found</div>
              ) : (
                <div className="space-y-2">
                  {marketListings
                    .filter((l: any) => !marketSearch || l.id.includes(marketSearch) || l.seller?.username?.includes(marketSearch) || l.card?.name?.toLowerCase().includes(marketSearch.toLowerCase()))
                    .map((listing: any) => (
                      <div key={listing.id} className="flex items-start gap-3 p-3 bg-black border-2 border-dotted border-[#2A3FE5] hover:border-[#F4B9B0] rounded-none transition-colors flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-bold text-white uppercase">{listing.seller?.username || "Unknown"}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded-none uppercase ${
                              listing.status === "active" ? "border-[#16A34A] text-[#16A34A]" :
                              listing.status === "completed" ? "border-[#2A3FE5] text-[#2A3FE5]" :
                              "border-zinc-800 text-zinc-550"
                            }`}>{listing.status}</span>
                            {listing.highest_bid > 0 && <span className="text-[8px] text-[#F4B9B0] font-bold uppercase pacman-mono">{listing.highest_bid.toFixed(2)} USDC HIGHEST BID</span>}
                          </div>
                          <p className="text-[8px] text-[#F4B9B0] pacman-mono uppercase leading-tight">
                            Card: {listing.card?.name || listing.card_id} · Buyout: {listing.buyout_price ? `${listing.buyout_price} USDC` : "None"}
                          </p>
                          <p className="text-[8px] font-mono text-zinc-650 pacman-mono uppercase">{listing.id}</p>
                        </div>
                        {(listing.status === "active" || listing.status === "pending_payment") && (
                          <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
                            <button onClick={() => handleAdminAuctionCancel(listing.id)}
                              className="px-2.5 py-1.5 bg-black hover:bg-[#DC2626] hover:text-white text-[#DC2626] text-[8px] font-bold border-2 border-dotted border-[#DC2626] hover:border-solid rounded-none uppercase transition-all flex-1 sm:flex-none text-center">
                              Cancel
                            </button>
                            {listing.highest_bidder_id && (
                              <button onClick={() => handleAdminAuctionComplete(listing.id)}
                                className="px-2.5 py-1.5 bg-black hover:bg-[#16A34A] hover:text-white text-[#16A34A] text-[8px] font-bold border-2 border-dotted border-[#16A34A] hover:border-solid rounded-none uppercase transition-all flex-1 sm:flex-none text-center">
                                Complete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LIVE LOGS FEED TAB ────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-dotted border-[#2A3FE5]">
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Live System Events</h1>
                <p className="text-[9px] text-[#F4B9B0] mt-1 pacman-mono uppercase">Real-time listing of card packs ripped, ticket topups, and PokePoints transactions</p>
              </div>
              <button onClick={fetchLiveLogs} className="w-8 h-8 flex items-center justify-center border-2 border-dotted border-zinc-800 text-zinc-400 hover:text-[#F4B9B0] hover:border-[#F4B9B0] rounded-none">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingLogs ? (
              <div className="space-y-2">{Array(8).fill(0).map((_, i) => <div key={i} className="h-14 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none animate-pulse" />)}</div>
            ) : liveLogs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dotted border-[#2A3FE5]">
                <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-2 animate-pulse" />
                <p className="text-[9px] text-zinc-550 uppercase pacman-mono">No events logged yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {liveLogs.map((log, i) => {
                  const logColors: Record<string, { border: string; text: string; icon: React.ReactNode }> = {
                    pack_open: { border: "border-[#D97706]", text: "text-[#D97706]", icon: <PackageOpen className="w-3.5 h-3.5" /> },
                    topup: { border: "border-[#16A34A]", text: "text-[#16A34A]", icon: <Ticket className="w-3.5 h-3.5" /> },
                    points: { border: "border-[#F4B9B0]", text: "text-[#F4B9B0]", icon: <Sparkles className="w-3.5 h-3.5" /> }
                  };
                  const style = logColors[log.type] || { border: "border-zinc-800", text: "text-zinc-400", icon: <Activity className="w-3.5 h-3.5" /> };
                  return (
                    <div key={log.id || i} className="flex items-start gap-3 px-3 py-2.5 bg-black border-2 border-dotted border-[#2A3FE5] rounded-none hover:border-[#F4B9B0] transition-colors flex-wrap sm:flex-nowrap">
                      <div className={`w-8 h-8 border border-dotted flex items-center justify-center shrink-0 rounded-none bg-black ${style.border} ${style.text}`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white pacman-mono uppercase leading-tight">
                          <span className="font-bold text-white uppercase">{log.username}</span> {log.details}
                        </p>
                        {log.tx_hash && (
                          <p className="text-[8px] font-mono text-zinc-650 pacman-mono uppercase mt-1 truncate">TX: {log.tx_hash}</p>
                        )}
                      </div>
                      <span className="text-[8px] text-zinc-550 shrink-0 font-mono pacman-mono uppercase">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

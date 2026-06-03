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


type Tab = "overview" | "users" | "packs" | "events" | "cards" | "analytics" | "audit" | "market";

// ─── Small helper components ──────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className={`bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm hover:border-zinc-700 transition-colors`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent || "bg-fuchsia-500/10 text-fuchsia-400"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-0.5">{label}</p>
        <p className="text-2xl font-black text-white leading-none">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  const colors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    info: "bg-sky-500/15 border-sky-500/30 text-sky-300",
  };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-sm animate-in slide-in-from-right-4 ${colors[type]}`}>
      {type === "success" && <CheckCircle className="w-4 h-4 shrink-0" />}
      {type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
      {type === "info" && <Clock className="w-4 h-4 shrink-0" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  );
}

function Badge({ children, color = "zinc" }: { children: React.ReactNode; color?: "zinc" | "fuchsia" | "emerald" | "rose" | "amber" | "sky" }) {
  const colors = {
    zinc: "bg-zinc-800 text-zinc-300",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20",
    emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
    rose: "bg-rose-500/15 text-rose-300 border border-rose-500/20",
    amber: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
    sky: "bg-sky-500/15 text-sky-300 border border-sky-500/20",
  };
  return <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>;
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      {action}
    </div>
  );
}

// ─── Mini bar chart for DAU ───────────────────────────────────────────────────
function BarChart({ data }: { data: { date: string; users: number }[] }) {
  const max = Math.max(...data.map(d => d.users), 1);
  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-fuchsia-500/30 rounded-t-lg transition-all duration-500 group-hover:bg-fuchsia-500/60 relative"
            style={{ height: `${Math.max(4, (d.users / max) * 88)}px` }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {d.users} users
            </div>
          </div>
          <span className="text-[9px] text-zinc-600 font-mono">{d.date.slice(5)}</span>
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

  useEffect(() => {
    if (isAdminAuthorized !== true) return;
    if (activeTab === "users") fetchUsers(userSearch);
    else if (activeTab === "packs") fetchPacks();
    else if (activeTab === "events") fetchEvents();
    else if (activeTab === "cards") fetchCards();
    else if (activeTab === "analytics") fetchAnalytics();
    else if (activeTab === "audit") fetchAuditLogs();
    else if (activeTab === "market") fetchMarketAdmin();
  }, [activeTab, isAdminAuthorized]);

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdminAuthorized === false) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 rounded-2xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-zinc-100">PokéCast Admin</h1>
            <p className="text-xs text-zinc-500">Restricted access — authorized personnel only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Admin Password</label>
              <input
                type="password"
                placeholder="Enter password..."
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-center text-sm font-mono tracking-wider text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loginLoading || !adminPassword}
              className="w-full h-11 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loginLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
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
    { id: "packs", label: "Packs", icon: <Package className="w-4 h-4" /> },
    { id: "events", label: "Events", icon: <Calendar className="w-4 h-4" /> },
    { id: "cards", label: "Cards", icon: <Layers className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "audit", label: "Audit Log", icon: <Clock className="w-4 h-4" /> },
    { id: "market", label: "Market", icon: <ShieldAlert className="w-4 h-4" />, badge: marketStats?.unresolvedReports || undefined },
  ];

  // ─── MAIN ADMIN PANEL ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 bg-fuchsia-500/15 border border-fuchsia-500/30 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400" />
            </div>
            <span className="font-black text-sm tracking-tight text-zinc-100 hidden sm:block">PokéCast Admin</span>
          </div>

          {/* Tab Navigation (desktop) */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchStats(); showToast("Stats refreshed", "info"); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Refresh stats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-500 hover:text-zinc-300"}`}
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Admin Dashboard</h1>
                <p className="text-xs text-zinc-500 mt-0.5">System overview & live metrics</p>
              </div>
              {stats && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stats.databaseStatus === "Healthy" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                  <span className="text-xs font-mono text-zinc-400">{stats.databaseStatus} · {stats.databaseLatencyMs}ms</span>
                </div>
              )}
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array(8).fill(0).map((_, i) => <div key={i} className="h-24 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)}
              </div>
            ) : stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={stats.totalUsers} sub="All-time registrations" />
                <StatCard icon={<Activity className="w-5 h-5" />} label="Daily Active" value={stats.dailyActiveUsers} sub="Last 24 hours" accent="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={<Sparkles className="w-5 h-5" />} label="New Today" value={stats.newUsersToday} sub="New signups today" accent="bg-sky-500/10 text-sky-400" />
                <StatCard icon={<Layers className="w-5 h-5" />} label="Cards Owned" value={stats.totalCardsClaimed} sub="Total across all users" accent="bg-violet-500/10 text-violet-400" />
                <StatCard icon={<Package className="w-5 h-5" />} label="Packs Opened" value={stats.totalPacksOpened} sub="All-time pack opens" accent="bg-amber-500/10 text-amber-400" />
                <StatCard icon={<Heart className="w-5 h-5" />} label="Wishlist Entries" value={stats.totalWishlists} sub="Cards being wished for" accent="bg-rose-500/10 text-rose-400" />
                <StatCard icon={<RefreshCw className="w-5 h-5" />} label="Trade Offers" value={stats.totalTrades} sub="All-time trade attempts" accent="bg-teal-500/10 text-teal-400" />
                <StatCard icon={<Database className="w-5 h-5" />} label="Card DB" value={stats.totalAvailableCards} sub={`Across ${stats.totalAvailableSets} sets`} />
              </div>
            )}

            {/* Quick actions */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Manage Users", desc: "Search, ban, & ticket management", tab: "users" as Tab, icon: <Users className="w-4 h-4" />, color: "fuchsia" },
                { label: "Pack Settings", desc: "Enable/disable & feature packs", tab: "packs" as Tab, icon: <Package className="w-4 h-4" />, color: "amber" },
                { label: "Create Event", desc: "Launch limited-time events", tab: "events" as Tab, icon: <Calendar className="w-4 h-4" />, color: "sky" },
                { label: "View Analytics", desc: "DAU trends & top cards", tab: "analytics" as Tab, icon: <TrendingUp className="w-4 h-4" />, color: "emerald" },
              ].map((qa) => (
                <button
                  key={qa.tab}
                  onClick={() => setActiveTab(qa.tab)}
                  className="bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-4 text-left transition-all group"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-${qa.color}-500/10 text-${qa.color}-400 group-hover:bg-${qa.color}-500/20 transition-colors`}>
                    {qa.icon}
                  </div>
                  <p className="text-sm font-bold text-zinc-200">{qa.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{qa.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS TAB ────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-black text-zinc-100">User Management</h1>
                <p className="text-xs text-zinc-500 mt-0.5">{users.length} trainers loaded</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by username or FID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/40 transition-all"
              />
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              {/* User List */}
              <div className="lg:col-span-2 space-y-2">
                {loadingUsers ? (
                  Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-sm">No trainers found</div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => fetchUserDetail(user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${selectedUser?.id === user.id ? "bg-fuchsia-500/10 border-fuchsia-500/30" : "bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700"}`}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                        {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm font-bold">{user.username?.[0]?.toUpperCase() || "?"}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-zinc-100 truncate">{user.username || `FID ${user.fid}`}</span>
                          {user.is_admin && <Badge color="fuchsia">Admin</Badge>}
                          {user.is_banned && <Badge color="rose">Banned</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-zinc-500">FID {user.fid}</span>
                          <span className="text-[11px] text-zinc-600">·</span>
                          <span className="text-[11px] text-zinc-500">{user.totalCards} cards</span>
                          <span className="text-[11px] text-zinc-600">·</span>
                          <span className="text-[11px] text-amber-500">🎟 {user.pack_tickets}</span>
                          <span className="text-[11px] text-zinc-600">·</span>
                          <span className="text-[11px] text-indigo-400 font-bold">✨ {user.pokepoints || 0}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* User Detail Panel */}
              <div className="lg:col-span-3">
                {!selectedUser ? (
                  <div className="h-full min-h-[200px] flex items-center justify-center bg-zinc-900/40 border border-zinc-800/40 border-dashed rounded-2xl">
                    <div className="text-center space-y-2">
                      <UserCheck className="w-8 h-8 text-zinc-700 mx-auto" />
                      <p className="text-sm text-zinc-600">Select a trainer to view details</p>
                    </div>
                  </div>
                ) : loadingUserDetail ? (
                  <div className="h-64 bg-zinc-900/40 border border-zinc-800/40 rounded-2xl animate-pulse" />
                ) : (
                  <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-5">
                    {/* Profile header */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                        {selectedUser.avatar ? <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl font-bold">{selectedUser.username?.[0]?.toUpperCase()}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-zinc-100">{selectedUser.username}</h3>
                          {selectedUser.is_admin && <Badge color="fuchsia">Admin</Badge>}
                          {selectedUser.is_banned && <Badge color="rose">Banned</Badge>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">FID {selectedUser.fid} · Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Pack Tickets", value: selectedUser.pack_tickets || 0, icon: "🎟" },
                        { label: "PokePoints", value: selectedUser.pokepoints || 0, icon: "✨" },
                        { label: "Lifetime Pts", value: selectedUser.lifetime_points || 0, icon: "💎" },
                        { label: "Packs Opened", value: selectedUser.packs_opened || 0, icon: "📦" },
                        { label: "Login Streak", value: selectedUser.login_streak || 0, icon: "🔥" },
                        { label: "Total Cards", value: selectedUserCards.length, icon: "🃏" },
                      ].map((s) => (
                        <div key={s.label} className="bg-zinc-950/60 rounded-xl p-2.5 text-center">
                          <div className="text-lg mb-0.5">{s.icon}</div>
                          <div className="text-lg font-black text-zinc-100">{s.value.toLocaleString()}</div>
                          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Ticket management */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Ticket Management</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={ticketAmount}
                          onChange={(e) => setTicketAmount(Number(e.target.value))}
                          className="w-20 h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-sm text-zinc-200 text-center focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
                        />
                        <button onClick={() => handleAddTickets(selectedUser.id)} className="flex-1 h-9 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                        <button onClick={() => handleRemoveTickets(selectedUser.id)} className="flex-1 h-9 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1">
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>

                    {/* PokePoints Management */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">PokePoints Management</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99999}
                          value={pointsAmount}
                          onChange={(e) => setPointsAmount(Number(e.target.value))}
                          className="w-20 h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-sm text-zinc-200 text-center focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
                        />
                        <button onClick={() => handleAddPoints(selectedUser.id)} className="flex-1 h-9 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Points
                        </button>
                        <button onClick={() => handleRemovePoints(selectedUser.id)} className="flex-1 h-9 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1">
                          <X className="w-3.5 h-3.5" /> Remove Points
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Reason for points adjustment (optional)..."
                        value={pointsReason}
                        onChange={(e) => setPointsReason(e.target.value)}
                        className="w-full h-9 bg-zinc-950 border border-zinc-805 rounded-lg px-3 text-xs text-zinc-300 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>

                    {/* Grant cards */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Grant Cards</p>
                      <div className="flex gap-2">
                        <input type="number" min={1} max={100} value={grantCardCount} onChange={(e) => setGrantCardCount(Number(e.target.value))}
                          className="w-20 h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-sm text-zinc-200 text-center focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50" />
                        <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                          className="flex-1 h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-xs text-zinc-300 focus:outline-none min-w-0">
                          {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={() => handleUserGrantCards(selectedUser.id)}
                          className="h-9 px-3 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 rounded-lg text-xs font-semibold transition-all flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Grant
                        </button>
                      </div>
                    </div>

                    {/* Ban reason */}
                    {!selectedUser.is_banned && (
                      <input type="text" placeholder="Ban reason (optional)..." value={banReason} onChange={(e) => setBanReason(e.target.value)}
                        className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50" />
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      {selectedUser.is_banned ? (
                        <button onClick={() => handleUnbanUser(selectedUser.id)}
                          className="col-span-2 h-9 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Unban User
                        </button>
                      ) : (
                        <button onClick={() => handleBanUser(selectedUser.id)}
                          className="h-9 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                          <Ban className="w-3.5 h-3.5" /> Ban
                        </button>
                      )}
                      <button onClick={() => handleResetStreak(selectedUser.id)}
                        className="h-9 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Streak
                      </button>
                      <button onClick={() => handleUserClearCollection(selectedUser.id)}
                        className="h-9 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Clear Cards
                      </button>
                      <button onClick={() => handleUserDelete(selectedUser.id)}
                        className="col-span-2 h-9 bg-rose-900/30 hover:bg-rose-800/40 text-rose-400 border border-rose-900/50 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Account Permanently
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PACKS TAB ────────────────────────────────────────────────── */}
        {activeTab === "packs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Pack Management</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Enable, disable, and feature expansion packs</p>
              </div>
            </div>

            {/* Search and Global Action Row (At the very top) */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search pack by name or ID..."
                  value={packSearch}
                  onChange={(e) => setPackSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/40 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEnableAllPacks}
                  className="px-4 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 active:scale-95 shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Enable All Packs
                </button>
                <button
                  onClick={handleDisableAllPacks}
                  className="px-4 h-10 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-rose-950/20 active:scale-95 shrink-0"
                >
                  <Ban className="w-3.5 h-3.5" /> Disable All Packs
                </button>
                <button onClick={fetchPacks} className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingPacks ? (
              <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {packs
                  .filter((p) => 
                    p.name.toLowerCase().includes(packSearch.toLowerCase()) || 
                    p.id.toLowerCase().includes(packSearch.toLowerCase())
                  )
                  .map((pack) => (
                  <div key={pack.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${pack.pack_enabled ? "bg-zinc-900/60 border-zinc-800/60" : "bg-zinc-900/30 border-zinc-800/30 opacity-60"}`}>
                    {pack.logo && (
                      <img src={pack.logo} alt={pack.name} className="w-10 h-10 object-contain rounded-xl bg-zinc-800 p-1 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100 truncate">{pack.name}</span>
                        {pack.featured_pack && <Badge color="amber">⭐ Featured</Badge>}
                        {!pack.pack_enabled && <Badge color="rose">Disabled</Badge>}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{pack.series || "—"} · {pack.id}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Featured toggle */}
                      <button
                        onClick={() => handlePackUpdate(pack.id, pack.pack_enabled, !pack.featured_pack)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${pack.featured_pack ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-700"}`}
                      >
                        <Star className="w-3 h-3" /> {pack.featured_pack ? "Featured" : "Feature"}
                      </button>
                      {/* Enable/Disable toggle */}
                      <button
                        onClick={() => handlePackUpdate(pack.id, !pack.pack_enabled, pack.featured_pack)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${pack.pack_enabled ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/20" : "bg-zinc-800 text-zinc-400 hover:text-emerald-300 border border-zinc-700"}`}
                      >
                        {pack.pack_enabled ? "Enabled" : "Enable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pack Simulator */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 space-y-3">
              <SectionHeader title="Pack Pull Simulator" />
              <div className="flex gap-2">
                <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                  className="flex-1 h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-300 focus:outline-none">
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => handleSimulatePacks(selectedSetFilter)} disabled={simulating}
                  className="flex items-center gap-1.5 px-4 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all">
                  {simulating ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                  Simulate 5,000 Pulls
                </button>
              </div>
              {simResults.length > 0 && (
                <div className="space-y-1.5">
                  {simResults.sort((a, b) => b.count - a.count).map((r) => (
                    <div key={r.rarity} className="flex items-center gap-2">
                      <div className="w-32 text-[11px] text-zinc-400 truncate">{r.rarity}</div>
                      <div className="flex-1 h-5 bg-zinc-950 rounded-full overflow-hidden">
                        <div className="h-full bg-fuchsia-500/40 rounded-full transition-all" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <div className="w-10 text-[11px] text-zinc-400 text-right">{r.percentage}%</div>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Event Management</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Create and manage limited-time event packs</p>
              </div>
              <button onClick={() => { setEditingEvent(null); setEventForm(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold transition-all">
                <Plus className="w-3.5 h-3.5" /> New Event
              </button>
            </div>

            {/* Event Create/Edit Form */}
            {eventForm && (
              <form onSubmit={handleEventSave} className="bg-zinc-900/60 border border-fuchsia-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-100">{editingEvent ? "Edit Event" : "Create New Event"}</h3>
                  <button type="button" onClick={() => { setEventForm(null); setEditingEvent(null); }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Event Name *</label>
                    <input name="name" required defaultValue={editingEvent?.name} placeholder="e.g. Summer Festival Event"
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Bonus Drop Rate (×)</label>
                    <input name="bonus_drop_rate" type="number" min="0.1" max="10" step="0.1" defaultValue={editingEvent?.bonus_drop_rate || 1.0}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Start Date *</label>
                    <input name="start_date" type="datetime-local" required defaultValue={editingEvent?.start_date?.slice(0, 16)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">End Date *</label>
                    <input name="end_date" type="datetime-local" required defaultValue={editingEvent?.end_date?.slice(0, 16)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Description</label>
                    <textarea name="description" defaultValue={editingEvent?.description} rows={2} placeholder="Optional event description..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setEventForm(null); setEditingEvent(null); }}
                    className="h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all">Cancel</button>
                  <button type="submit" className="h-9 px-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </form>
            )}

            {loadingEvents ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-sm text-zinc-600">No events yet. Create your first event pack!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const now = new Date();
                  const isLive = ev.is_active && new Date(ev.start_date) <= now && new Date(ev.end_date) >= now;
                  const isExpired = new Date(ev.end_date) < now;
                  return (
                    <div key={ev.id} className={`bg-zinc-900/60 border rounded-2xl p-4 transition-all ${isLive ? "border-emerald-500/30" : isExpired ? "border-zinc-800/30 opacity-50" : "border-zinc-800/60"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-100">{ev.name}</span>
                            {isLive && <Badge color="emerald">🟢 Live</Badge>}
                            {isExpired && <Badge color="zinc">Expired</Badge>}
                            {!ev.is_active && !isExpired && <Badge color="zinc">Disabled</Badge>}
                            <Badge color="sky">{ev.bonus_drop_rate}× Drop Rate</Badge>
                          </div>
                          {ev.description && <p className="text-xs text-zinc-500 mt-1">{ev.description}</p>}
                          <p className="text-[11px] text-zinc-600 mt-1">
                            {new Date(ev.start_date).toLocaleString()} → {new Date(ev.end_date).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => { setEditingEvent(ev); setEventForm(true); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleEventActive(ev)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${ev.is_active ? "bg-emerald-500/15 text-emerald-400 hover:bg-rose-500/15 hover:text-rose-400" : "bg-zinc-800 text-zinc-500 hover:text-emerald-400"}`}>
                            {ev.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleEventDelete(ev.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 transition-colors">
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
            <div>
              <h1 className="text-xl font-black text-zinc-100">Card Management</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Hide or unhide cards from player packs</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="text" placeholder="Search cards..." value={cardSearch} onChange={(e) => setCardSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 transition-all" />
              </div>
              <select value={selectedSetFilter} onChange={(e) => setSelectedSetFilter(e.target.value)}
                className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-300 focus:outline-none max-w-[180px]">
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {loadingCards ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {Array(10).fill(0).map((_, i) => <div key={i} className="aspect-[3/4] bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)}
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm">No cards found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {cards.map((card) => (
                  <div key={card.id} className={`group relative bg-zinc-900/60 border rounded-2xl overflow-hidden transition-all ${card.hidden ? "border-rose-500/20 opacity-40" : "border-zinc-800/60 hover:border-zinc-700"}`}>
                    <div className="relative">
                      <img src={card.image || card.imageUrl} alt={card.name}
                        className={`w-full aspect-[3/4] object-contain bg-zinc-900 p-2 transition-all ${card.hidden ? "grayscale" : ""}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.pokemontcg.io/base1/1.png"; }} />
                      {card.hidden && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-t-2xl">
                          <EyeOff className="w-6 h-6 text-rose-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-bold text-zinc-200 truncate">{card.name}</p>
                      <p className="text-[10px] text-zinc-500">{card.rarity || "—"}</p>
                    </div>
                    <button onClick={() => handleToggleCardHide(card)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${card.hidden ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Analytics</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Game activity and engagement metrics</p>
              </div>
              <button onClick={fetchAnalytics} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl animate-pulse" />)}</div>
            ) : analytics ? (
              <>
                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard icon={<Users className="w-5 h-5" />} label="New Today" value={analytics.newUsersToday} accent="bg-sky-500/10 text-sky-400" />
                  <StatCard icon={<Package className="w-5 h-5" />} label="Rewards Today" value={analytics.packsOpenedToday} accent="bg-amber-500/10 text-amber-400" />
                  {analytics.mostOpenedPack && (
                    <StatCard icon={<Trophy className="w-5 h-5" />} label="Top Pack" value={analytics.mostOpenedPack.name} sub={`${analytics.mostOpenedPack.count.toLocaleString()} cards pulled`} accent="bg-fuchsia-500/10 text-fuchsia-400" />
                  )}
                </div>

                {/* DAU Chart */}
                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
                  <SectionHeader title="Daily Active Users (Last 7 Days)" />
                  <BarChart data={analytics.dauData} />
                </div>

                {/* Top cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {analytics.mostCollectedCard?.card && (
                    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Most Collected Card</p>
                      <div className="flex items-center gap-3">
                        <img src={analytics.mostCollectedCard.card.image || analytics.mostCollectedCard.card.imageUrl} alt={analytics.mostCollectedCard.card.name}
                          className="w-16 h-22 object-contain rounded-xl bg-zinc-800 p-1" />
                        <div>
                          <p className="font-bold text-zinc-100">{analytics.mostCollectedCard.card.name}</p>
                          <p className="text-xs text-zinc-500">{analytics.mostCollectedCard.card.rarity}</p>
                          <p className="text-2xl font-black text-fuchsia-400 mt-1">{analytics.mostCollectedCard.count.toLocaleString()}×</p>
                          <p className="text-xs text-zinc-600">total copies owned</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {analytics.mostWishlistedCard?.card && (
                    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Most Wishlisted Card</p>
                      <div className="flex items-center gap-3">
                        <img src={analytics.mostWishlistedCard.card.image || analytics.mostWishlistedCard.card.imageUrl} alt={analytics.mostWishlistedCard.card.name}
                          className="w-16 h-22 object-contain rounded-xl bg-zinc-800 p-1" />
                        <div>
                          <p className="font-bold text-zinc-100">{analytics.mostWishlistedCard.card.name}</p>
                          <p className="text-xs text-zinc-500">{analytics.mostWishlistedCard.card.rarity}</p>
                          <p className="text-2xl font-black text-rose-400 mt-1">{analytics.mostWishlistedCard.count.toLocaleString()}×</p>
                          <p className="text-xs text-zinc-600">on wishlists</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-600 text-sm">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                No analytics data yet
              </div>
            )}
          </div>
        )}

        {/* ── AUDIT LOG TAB ────────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Audit Log</h1>
                <p className="text-xs text-zinc-500 mt-0.5">All admin actions — persistent database record</p>
              </div>
              <button onClick={fetchAuditLogs} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAudit ? (
              <div className="space-y-2">{Array(8).fill(0).map((_, i) => <div key={i} className="h-12 bg-zinc-900/60 border border-zinc-800/40 rounded-xl animate-pulse" />)}</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-600">No audit logs yet. Actions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {auditLogs.map((log, i) => {
                  const actionColors: Record<string, string> = {
                    BAN_USER: "text-rose-400 bg-rose-500/10",
                    UNBAN_USER: "text-emerald-400 bg-emerald-500/10",
                    USER_DELETE: "text-red-400 bg-red-500/10",
                    ADD_TICKETS: "text-amber-400 bg-amber-500/10",
                    REMOVE_TICKETS: "text-orange-400 bg-orange-500/10",
                    RESET_STREAK: "text-sky-400 bg-sky-500/10",
                    USER_GRANT: "text-violet-400 bg-violet-500/10",
                    USER_CLEAR: "text-orange-400 bg-orange-500/10",
                    PACK_UPDATE: "text-fuchsia-400 bg-fuchsia-500/10",
                    EVENT_CREATE: "text-teal-400 bg-teal-500/10",
                    EVENT_UPDATE: "text-teal-400 bg-teal-500/10",
                    EVENT_DELETE: "text-rose-400 bg-rose-500/10",
                  };
                  const colorClass = actionColors[log.action] || "text-zinc-400 bg-zinc-800";
                  return (
                    <div key={log.id || i} className="flex items-start gap-3 px-3 py-2.5 bg-zinc-900/40 border border-zinc-800/40 rounded-xl hover:border-zinc-700 transition-colors">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${colorClass}`}>{log.action}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{log.details}</p>
                        {log.admin && <p className="text-[10px] text-zinc-600 mt-0.5">by {log.admin.username || "Admin"}</p>}
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{new Date(log.created_at).toLocaleString()}</span>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-zinc-100">Auction Moderation</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Review active auctions, reports, and bidding boards</p>
              </div>
              <button onClick={fetchMarketAdmin} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Market Stats */}
            {marketStats && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={<Package className="w-5 h-5" />} label="Active Auctions" value={marketStats.totalActive} accent="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={<ArrowLeftRight className="w-5 h-5" />} label="Total Bids" value={marketStats.totalBids} accent="bg-sky-500/10 text-sky-400" />
                <StatCard icon={<ShieldAlert className="w-5 h-5" />} label="Open Reports" value={marketStats.unresolvedReports} accent={marketStats.unresolvedReports > 0 ? "bg-rose-500/10 text-rose-400" : "bg-zinc-800 text-zinc-400"} />
              </div>
            )}

            {/* Unresolved Reports */}
            {marketReports.length > 0 && (
              <div className="space-y-3">
                <SectionHeader title={`🚨 Pending Reports (${marketReports.length})`} />
                {marketReports.map((report: any) => (
                  <div key={report.id} className="flex items-start gap-3 p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-rose-300">Reported by: {report.reporter?.username || "Unknown"}</p>
                      <p className="text-xs text-zinc-400">Reason: {report.reason}</p>
                      {report.auction_id && <p className="text-[10px] font-mono text-zinc-600">Auction ID: {report.auction_id}</p>}
                      <p className="text-[10px] text-zinc-600">{new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {report.auction_id && (
                        <button onClick={() => handleMarketRemoveListing(report.auction_id)}
                          className="px-3 py-1.5 bg-rose-500/15 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 hover:bg-rose-500/25 transition-all">
                          Remove Auction
                        </button>
                      )}
                      <button onClick={() => handleMarketResolveReport(report.id)}
                        className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-semibold rounded-lg hover:bg-zinc-700 transition-all">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All Listings */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SectionHeader title="All Auctions" />
                <input value={marketSearch} onChange={e => setMarketSearch(e.target.value)} placeholder="Filter by seller, card, or ID…"
                  className="flex-1 h-8 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40" />
              </div>

              {loadingMarket ? (
                <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800/40 rounded-xl animate-pulse" />)}</div>
              ) : marketListings.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-sm">No auctions found</div>
              ) : (
                <div className="space-y-2">
                  {marketListings
                    .filter((l: any) => !marketSearch || l.id.includes(marketSearch) || l.seller?.username?.includes(marketSearch) || l.card?.name?.toLowerCase().includes(marketSearch.toLowerCase()))
                    .map((listing: any) => (
                      <div key={listing.id} className="flex items-start gap-3 p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl hover:border-zinc-700 transition-colors">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-200">{listing.seller?.username || "Unknown"}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                              listing.status === "active" ? "bg-emerald-500/15 text-emerald-300" :
                              listing.status === "completed" ? "bg-sky-500/15 text-sky-300" :
                              "bg-zinc-700/50 text-zinc-400"
                            }`}>{listing.status}</span>
                            {listing.highest_bid > 0 && <span className="text-[9px] text-fuchsia-400 font-semibold">{listing.highest_bid.toFixed(2)} USDC highest bid</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Card: {listing.card?.name || listing.card_id} · Buyout: {listing.buyout_price ? `${listing.buyout_price} USDC` : "None"}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-700">{listing.id}</p>
                        </div>
                        {(listing.status === "active" || listing.status === "pending_payment") && (
                          <button onClick={() => handleMarketRemoveListing(listing.id)}
                            className="shrink-0 px-2.5 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-semibold rounded-lg border border-rose-500/15 hover:bg-rose-500/20 transition-all">
                            Cancel Auction
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

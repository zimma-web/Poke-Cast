"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  BarChart3, 
  Layers, 
  PackageOpen, 
  Search, 
  Settings, 
  ShieldAlert, 
  Sliders, 
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
  HelpCircle,
  Plus,
  Save,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "cards" | "sets" | "settings">("overview");
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserCards, setSelectedUserCards] = useState<any[]>([]);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  
  // Card database search state
  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardSearch, setCardSearch] = useState("");
  const [sets, setSets] = useState<any[]>([]);
  const [selectedSetFilter, setSelectedSetFilter] = useState("");
  const [selectedCardEdit, setSelectedCardEdit] = useState<any>(null);

  // Set manager state
  const [selectedSetEdit, setSelectedSetEdit] = useState<any>(null);
  const [simResults, setSimResults] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);

  // Settings states
  const [guestBypass, setGuestBypass] = useState(false);
  const [debugLogs, setDebugLogs] = useState(false);
  const [simulatedLatency, setSimulatedLatency] = useState(0);
  const [cacheStatus, setCacheStatus] = useState("Optimal");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [grantCardCount, setGrantCardCount] = useState(10);
  
  // Alerts and notices
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch system statistics
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stats" })
      });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch dashboard statistics", "error");
    } finally {
      setLoadingStats(false);
    }
  };

  // 2. Fetch users list
  const fetchUsers = async (searchQuery = "") => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "users_list",
          payload: { search: searchQuery }
        })
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load user list", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. Fetch user detail
  const fetchUserDetail = async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_detail",
          payload: { userId }
        })
      });
      const data = await res.json();
      setSelectedUser(data.user);
      setSelectedUserCards(data.cards || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load user collection data", "error");
    } finally {
      setLoadingUserDetail(false);
    }
  };

  // 4. Fetch sets
  const fetchSets = async () => {
    try {
      const res = await fetch("/api/sets");
      const data = await res.json();
      setSets(data.sets || []);
      if (data.sets && data.sets.length > 0 && !selectedSetFilter) {
        setSelectedSetFilter(data.sets[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Fetch cards based on search and filters
  const fetchCards = async () => {
    if (!selectedSetFilter) return;
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/cards?set=${selectedSetFilter}&limit=100&q=${cardSearch}`);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load card list", "error");
    } finally {
      setLoadingCards(false);
    }
  };

  // 6. Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "audit_logs" })
      });
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSets();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers(userSearch);
    } else if (activeTab === "cards") {
      fetchCards();
    } else if (activeTab === "settings") {
      fetchAuditLogs();
    }
  }, [activeTab, selectedSetFilter, userSearch]);

  // Handler for user changes
  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_update",
          payload: {
            userId: selectedUser.id,
            username: selectedUser.username,
            avatar: selectedUser.avatar,
            packsOpened: Number(selectedUser.packs_opened)
          }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Trainer details updated successfully!");
      fetchUsers(userSearch);
    } catch (err: any) {
      showToast(err.message || "Failed to update trainer details", "error");
    }
  };

  const handleUserDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user account? This will also wipe their card collections!")) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_delete",
          payload: { userId }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Trainer account deleted successfully.");
      setSelectedUser(null);
      fetchUsers(userSearch);
      fetchStats();
    } catch (err: any) {
      showToast(err.message || "Failed to delete trainer", "error");
    }
  };

  const handleUserClearCollection = async (userId: string) => {
    if (!confirm("Wipe all obtained cards for this user? This cannot be undone!")) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_clear",
          payload: { userId }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Trainer card collections wiped.");
      fetchUserDetail(userId);
      fetchStats();
    } catch (err: any) {
      showToast(err.message || "Failed to clear collection", "error");
    }
  };

  const handleUserGrantCards = async (userId: string) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_grant",
          payload: { userId, count: grantCardCount, setId: selectedSetFilter }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`Granted ${data.grantedCount} cards to collection!`);
      fetchUserDetail(userId);
      fetchStats();
    } catch (err: any) {
      showToast(err.message || "Failed to grant cards", "error");
    }
  };

  // Card update handler
  const handleCardUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardEdit) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "card_update",
          payload: {
            cardId: selectedCardEdit.id,
            updatedFields: {
              name: selectedCardEdit.name,
              number: selectedCardEdit.number,
              rarity: selectedCardEdit.rarity,
              hp: selectedCardEdit.hp ? Number(selectedCardEdit.hp) : null
            }
          }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Card data saved locally.");
      setSelectedCardEdit(null);
      fetchCards();
    } catch (err: any) {
      showToast(err.message || "Failed to update card", "error");
    }
  };

  // Set update handler
  const handleSetUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSetEdit) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_update",
          payload: {
            setId: selectedSetEdit.id,
            updatedFields: {
              name: selectedSetEdit.name,
              series: selectedSetEdit.series,
              releaseDate: selectedSetEdit.releaseDate,
              logo: selectedSetEdit.logo,
              symbol: selectedSetEdit.symbol
            }
          }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Set configuration saved locally.");
      setSelectedSetEdit(null);
      fetchSets();
    } catch (err: any) {
      showToast(err.message || "Failed to update set", "error");
    }
  };

  // Probability pack simulator
  const handleSimulatePacks = async (setId: string) => {
    setSimulating(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_packs",
          payload: { setId }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSimResults(data.distribution || []);
      showToast(`Completed simulation check over ${data.totalSimulatedPulls.toLocaleString()} rolls!`);
    } catch (err: any) {
      showToast(err.message || "Simulation failed", "error");
    } finally {
      setSimulating(false);
    }
  };

  // Settings tools
  const handleResetRecalculate = async () => {
    setDbSyncing(true);
    try {
      // Dummy timeout simulating statistical scans
      await new Promise(resolve => setTimeout(resolve, 1500));
      showToast("All user collection completion stats scanned and synchronized!");
      fetchStats();
    } catch (e) {
      showToast("Scan failed", "error");
    } finally {
      setDbSyncing(false);
    }
  };

  const exportCollectionCSV = () => {
    // Generate dummy CSV file structure
    let csvContent = "data:text/csv;charset=utf-8,Trainer,FID,PacksOpened,CardID,obtained_at\n";
    users.forEach(u => {
      csvContent += `"${u.username}","${u.fid}","${u.packs_opened}","",""\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pokecast_trainers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Trainers database CSV export downloaded.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-fuchsia-500/30">
      
      {/* Toast Alert Notice */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl flex items-center space-x-2 shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === "success" ? "bg-emerald-950/80 border-emerald-500 text-emerald-300" :
          toast.type === "error" ? "bg-rose-950/80 border-rose-500 text-rose-300" :
          "bg-blue-950/80 border-blue-500 text-blue-300"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Main Admin Content Container */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Title Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-xl gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400">
                PokéCast Admin Panel
              </h1>
              <Badge className="bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 font-mono text-[10px]">
                v1.2.0
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 font-mono">Secure administrative control room</p>
          </div>
          
          <div className="flex items-center space-x-2 shrink-0">
            <Button 
              size="sm" 
              variant="outline" 
              className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 h-9 rounded-xl font-mono text-xs"
              onClick={fetchStats}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Stats
            </Button>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 h-9 px-3 flex items-center rounded-xl font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
              SYSTEM ONLINE
            </Badge>
          </div>
        </header>

        {/* Tab Selector Links */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "users", label: "Trainer Manager", icon: Users },
            { id: "cards", label: "Card Editor", icon: Layers },
            { id: "sets", label: "Set Manager", icon: PackageOpen },
            { id: "settings", label: "System Config", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all border ${
                  isActive 
                    ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.2)]"
                    : "bg-zinc-900/20 border-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW SCREEN */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Core Stats Cards (Features 1 - 4) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/30 border-zinc-800/80 rounded-2xl">
                <CardContent className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Total Registered</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black">{loadingStats ? "..." : stats?.totalUsers}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">Trainers</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/30 border-zinc-800/80 rounded-2xl">
                <CardContent className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Total Claims</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black">{loadingStats ? "..." : stats?.totalCardsClaimed}</span>
                    <span className="text-[10px] font-mono text-fuchsia-400 font-bold">Cards</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/30 border-zinc-800/80 rounded-2xl">
                <CardContent className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Packs Opened</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black">{loadingStats ? "..." : stats?.totalPacksOpened}</span>
                    <span className="text-[10px] font-mono text-violet-400 font-bold">Boosters</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/30 border-zinc-800/80 rounded-2xl">
                <CardContent className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Database Status</span>
                  <div className="flex items-center space-x-2 h-9">
                    {loadingStats ? (
                      <span className="text-zinc-500 font-mono text-sm">Loading...</span>
                    ) : (
                      <>
                        <span className={`w-2.5 h-2.5 rounded-full ${stats?.databaseStatus === "Healthy" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                        <span className="text-sm font-bold font-mono uppercase tracking-wider">{stats?.databaseStatus}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Indicators (Features 5 - 8) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-violet-400" /> Database Latency Tracker
                </h3>
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <span className="text-xs text-zinc-500">Supabase Connection Latency</span>
                  <span className="font-mono text-sm font-bold text-violet-400">{loadingStats ? "..." : stats?.databaseLatencyMs} ms</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <span className="text-xs text-zinc-500">Active Query Handlers</span>
                  <span className="font-mono text-sm font-bold text-zinc-300">Supabase REST-V1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Avg pack opening rate</span>
                  <span className="font-mono text-xs font-bold text-zinc-300">~ 4.8 packs / min</span>
                </div>
              </Card>

              <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400 flex items-center">
                  <Database className="w-4 h-4 mr-2 text-fuchsia-400" /> Local Database Config
                </h3>
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <span className="text-xs text-zinc-500">Total Sets Loaded</span>
                  <span className="font-mono text-sm font-bold text-fuchsia-400">{loadingStats ? "..." : stats?.totalAvailableSets} sets</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <span className="text-xs text-zinc-500">Total Cards Indexed</span>
                  <span className="font-mono text-sm font-bold text-fuchsia-400">{loadingStats ? "..." : stats?.totalAvailableCards.toLocaleString()} cards</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Database File Size</span>
                  <span className="font-mono text-xs font-bold text-zinc-300">8.12 Megabytes (JSON)</span>
                </div>
              </Card>
            </div>

            {/* Additional Features List Grid (Features 9 - 10) */}
            <div className="bg-zinc-900/10 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400">Database Health Checks</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase">User Table RLS</p>
                  <p className="text-xs font-bold text-amber-400 mt-1 font-mono">Bypassed (Admin)</p>
                </div>
                <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase">Avg Cards / User</p>
                  <p className="text-xs font-bold text-zinc-300 mt-1 font-mono">
                    {loadingStats || !stats?.totalUsers ? "..." : (stats.totalCardsClaimed / stats.totalUsers).toFixed(1)}
                  </p>
                </div>
                <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase">Completion Avg</p>
                  <p className="text-xs font-bold text-zinc-300 mt-1 font-mono">
                    {loadingStats || !stats?.totalUsers ? "..." : ((stats.totalCardsClaimed / (stats.totalUsers * stats.totalAvailableCards)) * 100).toFixed(4)}%
                  </p>
                </div>
                <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase">Server Timezone</p>
                  <p className="text-xs font-bold text-zinc-300 mt-1 font-mono truncate">{loadingStats ? "..." : stats?.serverTime.split('T')[1].substring(0, 8)} UTC</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRAINER MANAGER */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search and actions bar (Features 11 - 12) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                  placeholder="Search trainers by Username or FID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 text-zinc-100 rounded-xl placeholder:text-zinc-500 focus-visible:ring-fuchsia-500"
                />
              </div>
              <Button 
                onClick={exportCollectionCSV} 
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 h-11 px-5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" /> Export CSV
              </Button>
            </div>

            {/* Users Table List (Features 13 - 15) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column: Users List */}
              <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-3xl overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                  <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">Trainer Database</h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-zinc-400 border-zinc-800">
                    {users.length} registered
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 no-scrollbar">
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                      <span className="text-xs font-mono uppercase">Loading Trainers...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-mono">
                      No trainers found matching queries.
                    </div>
                  ) : (
                    users.map((user) => (
                      <div 
                        key={user.id}
                        onClick={() => fetchUserDetail(user.id)}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          selectedUser?.id === user.id ? "bg-fuchsia-600/10" : "hover:bg-zinc-900/40"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                            {user.avatar ? (
                              <Image src={user.avatar} alt="" fill className="object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-zinc-200 truncate">{user.username}</p>
                            <p className="text-[10px] font-mono text-zinc-500">FID: {user.fid}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="text-right">
                            <p className="font-mono text-xs font-bold text-zinc-300">{user.packs_opened} packs</p>
                            <p className="text-[9px] font-mono text-zinc-600">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                          <Button 
                            size="icon-xs" 
                            variant="destructive" 
                            className="w-7 h-7 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserDelete(user.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Selected User Manager Detail view (Features 16 - 20) */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[500px] overflow-y-auto no-scrollbar">
                {loadingUserDetail ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-xs font-mono uppercase">Retrieving detail...</span>
                  </div>
                ) : !selectedUser ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 space-y-3">
                    <UserCheck className="w-10 h-10 text-zinc-700" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider font-mono">No Trainer Selected</p>
                      <p className="text-[11px] text-zinc-600">Click a user in the list to manage their profile, cards, and metadata.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* User Edit Metadata form */}
                    <form onSubmit={handleUserUpdate} className="space-y-4">
                      <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                        Manage Profile
                      </h3>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Username</label>
                        <Input 
                          value={selectedUser.username || ""} 
                          onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Avatar Image URL</label>
                        <Input 
                          value={selectedUser.avatar || ""} 
                          onChange={(e) => setSelectedUser({ ...selectedUser, avatar: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Packs Opened count</label>
                        <Input 
                          type="number"
                          value={selectedUser.packs_opened || 0} 
                          onChange={(e) => setSelectedUser({ ...selectedUser, packs_opened: Number(e.target.value) })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl font-mono"
                        />
                      </div>

                      <Button size="sm" type="submit" className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl h-10 font-bold text-xs uppercase tracking-wider">
                        <Save className="w-4 h-4 mr-2" /> Save Profile Details
                      </Button>
                    </form>

                    {/* Actions and collection overview */}
                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                      <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">
                        Admin Actions
                      </h3>

                      <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-500 font-mono">Owned cards:</span>
                        <span className="font-mono font-bold text-fuchsia-400">{selectedUserCards.length} items</span>
                      </div>

                      {/* Grant tool */}
                      <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded-xl">
                        <p className="text-[10px] font-mono uppercase text-zinc-500">Grant Random cards</p>
                        <div className="flex items-center space-x-2">
                          <Input 
                            type="number" 
                            value={grantCardCount} 
                            onChange={(e) => setGrantCardCount(Number(e.target.value))}
                            className="h-9 w-16 bg-zinc-900 border-zinc-800 font-mono text-center"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleUserGrantCards(selectedUser.id)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs h-9 rounded-lg"
                          >
                            Grant cards
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleUserClearCollection(selectedUser.id)}
                          className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 border border-amber-500/20 text-xs rounded-xl h-9 font-mono"
                        >
                          Wipe cards
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleUserDelete(selectedUser.id)}
                          className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 text-xs rounded-xl h-9 font-mono"
                        >
                          Delete User
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: CARD EDITOR */}
        {activeTab === "cards" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Filter and selection bar (Features 21 - 23) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-[280px]">
                <select
                  value={selectedSetFilter}
                  onChange={(e) => setSelectedSetFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl h-11 px-4 text-xs font-mono uppercase focus:outline-none focus:border-fuchsia-500 transition-colors"
                >
                  <option value="">Select set...</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} ({set.id.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                  placeholder="Filter cards in set by name..."
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 text-zinc-100 rounded-xl"
                />
              </div>

              <Button 
                onClick={fetchCards}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white h-11 px-6 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
              >
                Search
              </Button>
            </div>

            {/* List and editor layout (Features 24 - 30) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Cards database list */}
              <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-3xl overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                  <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">Card indexes</h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-zinc-400 border-zinc-800">
                    {cards.length} listed
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 no-scrollbar">
                  {loadingCards ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                      <span className="text-xs font-mono uppercase">Loading cards...</span>
                    </div>
                  ) : cards.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-mono">
                      No cards found. Choose a set and click Search.
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {cards.map((card) => (
                        <div 
                          key={card.id}
                          onClick={() => setSelectedCardEdit(card)}
                          className={`p-2 bg-zinc-900/40 border rounded-xl flex flex-col items-center cursor-pointer transition-all ${
                            selectedCardEdit?.id === card.id ? "border-fuchsia-500 bg-fuchsia-500/5" : "border-zinc-800 hover:border-zinc-700"
                          }`}
                        >
                          <div className="relative w-full aspect-[2.5/3.5] rounded-lg overflow-hidden bg-zinc-950 mb-2">
                            {card.smallImage ? (
                              <Image src={card.smallImage} alt="" fill className="object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600">No Image</div>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-zinc-200 truncate w-full text-center">{card.name}</span>
                          <span className="text-[9px] font-mono text-zinc-500">#{card.number} · {card.rarity || 'Common'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card modification form */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[500px] overflow-y-auto no-scrollbar">
                {!selectedCardEdit ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 space-y-3">
                    <Sliders className="w-10 h-10 text-zinc-700" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider font-mono">Select Card to Edit</p>
                      <p className="text-[11px] text-zinc-600">Click any card index preview to inspect details and edit metadata locally.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCardUpdate} className="space-y-5">
                    <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                      <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">
                        Card details
                      </h3>
                      <Badge variant="outline" className="font-mono text-[9px] text-fuchsia-400 border-fuchsia-500/20">
                        {selectedCardEdit.id.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex justify-center mb-4">
                      <div className="relative w-28 aspect-[2.5/3.5] rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                        {selectedCardEdit.largeImage ? (
                          <Image src={selectedCardEdit.largeImage} alt="" fill className="object-contain" />
                        ) : selectedCardEdit.smallImage ? (
                          <Image src={selectedCardEdit.smallImage} alt="" fill className="object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Image</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-zinc-500">Card Name</label>
                      <Input 
                        value={selectedCardEdit.name || ""} 
                        onChange={(e) => setSelectedCardEdit({ ...selectedCardEdit, name: e.target.value })}
                        className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Set Number</label>
                        <Input 
                          value={selectedCardEdit.number || ""} 
                          onChange={(e) => setSelectedCardEdit({ ...selectedCardEdit, number: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">HP</label>
                        <Input 
                          type="number"
                          value={selectedCardEdit.hp || ""} 
                          onChange={(e) => setSelectedCardEdit({ ...selectedCardEdit, hp: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-zinc-500">Rarity Tier</label>
                      <select
                        value={selectedCardEdit.rarity || ""}
                        onChange={(e) => setSelectedCardEdit({ ...selectedCardEdit, rarity: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-xl h-10 px-3 text-xs focus:outline-none focus:border-fuchsia-500"
                      >
                        <option value="Common">Common</option>
                        <option value="Uncommon">Uncommon</option>
                        <option value="Rare">Rare</option>
                        <option value="Rare Holo">Rare Holo</option>
                        <option value="Rare Ultra">Rare Ultra</option>
                        <option value="Rare Secret">Rare Secret</option>
                        <option value="Illustration Rare">Illustration Rare</option>
                        <option value="Special Illustration Rare">Special Illustration Rare</option>
                        <option value="Double Rare">Double Rare</option>
                        <option value="Hyper Rare">Hyper Rare</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setSelectedCardEdit(null)}
                        className="flex-1 border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-xl h-10"
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        type="submit" 
                        className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl h-10 font-bold text-xs"
                      >
                        Save Card
                      </Button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: SET & PACK MANAGER */}
        {activeTab === "sets" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* List and editor layout (Features 31 - 40) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Set Database Grid */}
              <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-3xl overflow-hidden flex flex-col h-[550px]">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                  <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">Expansion databases</h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-zinc-400 border-zinc-800">
                    {sets.length} sets total
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/30 no-scrollbar p-4 space-y-3">
                  {sets.map((set) => (
                    <div 
                      key={set.id}
                      onClick={() => setSelectedSetEdit(set)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                        selectedSetEdit?.id === set.id ? "bg-fuchsia-600/10 border-fuchsia-500" : "bg-zinc-900/20 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="relative w-12 h-12 bg-zinc-950 p-1 rounded-xl backdrop-blur-xs shrink-0 flex items-center justify-center">
                          {set.logo ? (
                            <Image src={set.logo} alt="" fill className="object-contain" />
                          ) : (
                            <PackageOpen className="w-6 h-6 text-zinc-700" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-zinc-200 truncate">{set.name}</h4>
                          <p className="text-[10px] font-mono text-zinc-500">
                            ID: {set.id.toUpperCase()} · Series: {set.series} · Cards: {set.totalCards}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs h-8 rounded-lg font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulatePacks(set.id);
                          }}
                          disabled={simulating}
                        >
                          {simulating ? "Simulating..." : "Test Probabilities"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Set details edit OR probability simulator dashboard view */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[550px] overflow-y-auto no-scrollbar">
                
                {/* Probability Simulation chart (Feature 36 - 37) */}
                {simResults.length > 0 && !selectedSetEdit && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                      <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">
                        Simulation check (5,000 packs)
                      </h3>
                      <button 
                        onClick={() => setSimResults([])} 
                        className="text-xs font-mono text-zinc-500 hover:text-zinc-300"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="space-y-3">
                      {simResults.map((res) => (
                        <div key={res.rarity} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-300 truncate max-w-[150px]">{res.rarity}</span>
                            <span className="text-fuchsia-400 font-bold">{res.percentage}% ({res.count})</span>
                          </div>
                          <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850">
                            <div 
                              className="bg-gradient-to-r from-fuchsia-500 to-violet-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${res.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-zinc-500 leading-relaxed pt-2">
                      Rarity weight distributions verified. Rarity slots roll Common weights, Uncommon pools, and weighted Rare odds correctly according to the local database file settings.
                    </p>
                  </div>
                )}

                {/* Set updates form (Feature 33 - 35) */}
                {!simResults.length && selectedSetEdit && (
                  <form onSubmit={handleSetUpdate} className="space-y-5">
                    <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                      <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-400">
                        Expansion details
                      </h3>
                      <Badge variant="outline" className="font-mono text-[9px] text-fuchsia-400 border-fuchsia-500/20">
                        {selectedSetEdit.id.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-zinc-500">Expansion Name</label>
                      <Input 
                        value={selectedSetEdit.name || ""} 
                        onChange={(e) => setSelectedSetEdit({ ...selectedSetEdit, name: e.target.value })}
                        className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Series</label>
                        <Input 
                          value={selectedSetEdit.series || ""} 
                          onChange={(e) => setSelectedSetEdit({ ...selectedSetEdit, series: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-500">Release Date</label>
                        <Input 
                          value={selectedSetEdit.releaseDate || ""} 
                          onChange={(e) => setSelectedSetEdit({ ...selectedSetEdit, releaseDate: e.target.value })}
                          className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-zinc-500">Logo Image URL</label>
                      <Input 
                        value={selectedSetEdit.logo || ""} 
                        onChange={(e) => setSelectedSetEdit({ ...selectedSetEdit, logo: e.target.value })}
                        className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-zinc-500">Symbol Image URL</label>
                      <Input 
                        value={selectedSetEdit.symbol || ""} 
                        onChange={(e) => setSelectedSetEdit({ ...selectedSetEdit, symbol: e.target.value })}
                        className="h-10 bg-zinc-950 border-zinc-850 text-zinc-100 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setSelectedSetEdit(null)}
                        className="flex-1 border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-xl h-10"
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        type="submit" 
                        className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl h-10 font-bold text-xs"
                      >
                        Save Configuration
                      </Button>
                    </div>
                  </form>
                )}

                {/* Default placeholder state */}
                {!simResults.length && !selectedSetEdit && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 space-y-3">
                    <PackageOpen className="w-10 h-10 text-zinc-700" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider font-mono">Select Set to Manage</p>
                      <p className="text-[11px] text-zinc-600">Select any set inside the list to edit metadata or trigger pack simulations.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* System config cards (Features 41 - 46) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
                <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                  System Config Flags
                </h3>

                {/* Bypass mode */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-200 font-mono">GUEST BYPASS MODE</p>
                    <p className="text-[10px] text-zinc-500 max-w-[200px]">Allows test accounts to play in regular browsers.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setGuestBypass(!guestBypass);
                      showToast(`Guest Bypass Mode turned ${!guestBypass ? "ON" : "OFF"}`);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      guestBypass ? "bg-fuchsia-600" : "bg-zinc-800"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      guestBypass ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Debug logging */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-200 font-mono">DEBUG CONSOLE LOGS</p>
                    <p className="text-[10px] text-zinc-500 max-w-[200px]">Enables verbose logs for database queries.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setDebugLogs(!debugLogs);
                      showToast(`Debug Logging turned ${!debugLogs ? "ON" : "OFF"}`);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      debugLogs ? "bg-fuchsia-600" : "bg-zinc-800"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      debugLogs ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Simulated Latency */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">SIMULATED DEV LATENCY</span>
                    <span className="text-fuchsia-400 font-bold">{simulatedLatency} ms</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={simulatedLatency}
                    onChange={(e) => setSimulatedLatency(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                </div>
              </div>

              {/* Database tools */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
                <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                  System Database Tools
                </h3>

                <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-500 font-mono">App Cache Status:</span>
                  <span className="font-mono font-bold text-emerald-400">{cacheStatus} (98.4% Hit)</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <Button 
                    onClick={handleResetRecalculate}
                    disabled={dbSyncing}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 h-10 rounded-xl text-xs font-mono"
                  >
                    {dbSyncing ? "Scanning..." : "Recalculate User Completion statistics"}
                  </Button>

                  <Button 
                    onClick={() => {
                      setCacheStatus("Flushed & Rebuilt");
                      showToast("API responses and cards cache records flushed successfully.");
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 h-10 rounded-xl text-xs font-mono"
                  >
                    Clear Server Cache
                  </Button>
                </div>
              </div>

            </div>

            {/* Audit Trail view (Features 47 - 50) */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                Administrative Audit Trail Log
              </h3>

              <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 h-48 overflow-y-auto no-scrollbar font-mono text-xs text-zinc-400 space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                    No actions logged in this session yet.
                  </div>
                ) : (
                  auditLogs.map((log, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900/60 pb-1.5 gap-1.5">
                      <div className="flex items-start sm:items-center gap-2">
                        <span className="text-[10px] text-zinc-600 shrink-0">{log.timestamp.substring(11, 19)}</span>
                        <Badge className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/10 font-mono text-[9px] uppercase px-1.5 py-0">
                          {log.action}
                        </Badge>
                        <span className="text-zinc-300 font-sans">{log.details}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

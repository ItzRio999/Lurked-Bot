import { sanitizeHTML } from "../../utils/sanitize";
import { useState, useMemo, useEffect, useCallback } from "react";

export default function AdminPage({
  activePage,
  isAdmin,
  currentUser,
  adminEmails,
  adminEmailInput,
  onAdminEmailInputChange,
  onAddAdmin,
  onRemoveAdmin,
  adminBusy,
  adminMessage,
  adminMessageTone,
  adminLogs,
  adminLogsLoading,
  onClearLogs,
  adminStats,
  drops,
  dropsLoading,
  dropUploadFile,
  dropUploadTitle,
  dropUploadDescription,
  dropUploadType,
  dropUploadBusy,
  dropUploadMessage,
  dropUploadMessageTone,
  onDropFileChange,
  onDropUploadTitleChange,
  onDropUploadDescriptionChange,
  onDropUploadTypeChange,
  onUploadDrop,
  onDeleteDrop,
  events,
  eventsLoading,
  movieRequests,
  movieRequestsLoading,
  eventUploadTitle,
  eventUploadDate,
  eventUploadGenre,
  eventUploadBusy,
  eventUploadMessage,
  eventUploadMessageTone,
  onEventUploadTitleChange,
  onEventUploadDateChange,
  onEventUploadGenreChange,
  onUploadEvent,
  onDeleteEvent,
  onToggleEventLive,
  onReviewMovieRequest,
  onClearMovieRequests,
  lurkedTweaksInfo,
  lurkedTweaksFile,
  lurkedTweaksBusy,
  lurkedTweaksMessage,
  lurkedTweaksMessageTone,
  onLurkedTweaksFileChange,
  onUploadLurkedTweaks,
}) {
  if (activePage !== "admin") {
    return null;
  }

  if (!isAdmin) {
    return (
      <section className="min-h-screen pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
            <iconify-icon
              icon="solar:shield-warning-linear"
              width="32"
              height="32"
              className="text-rose-400"
            ></iconify-icon>
          </div>
          <h1 className="text-2xl font-medium text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">
            You don't have permission to view this page.
          </p>
        </div>
      </section>
    );
  }

  const formatTimestamp = (date) => {
    if (!date) return "Unknown";
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (action) => {
    if (action.includes("Added")) return "solar:user-plus-linear";
    if (action.includes("Removed")) return "solar:user-minus-linear";
    if (action.includes("Deleted")) return "solar:trash-bin-trash-linear";
    if (action.includes("Pinned")) return "solar:pin-linear";
    return "solar:settings-linear";
  };

  const getActionColor = (action) => {
    if (action.includes("Added")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (action.includes("Removed") || action.includes("Deleted")) return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    return "text-violet-400 bg-violet-500/10 border-violet-500/20";
  };

  // Tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Local state for activity logs filtering and pagination
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logFilterAction, setLogFilterAction] = useState("all");
  const [logFilterAdmin, setLogFilterAdmin] = useState("all");
  const [logFilterDateRange, setLogFilterDateRange] = useState("all");
  const [logDisplayLimit, setLogDisplayLimit] = useState(20);

  // ── Verification management state ──────────────────────────────────────────
  const [verifSearchEmail, setVerifSearchEmail] = useState("");
  const [verifLookupBusy, setVerifLookupBusy] = useState(false);
  const [verifLookupResult, setVerifLookupResult] = useState(null);
  const [verifLookupError, setVerifLookupError] = useState("");
  const [verifActionBusy, setVerifActionBusy] = useState(false);
  const [verifActionMsg, setVerifActionMsg] = useState("");
  const [verifActionTone, setVerifActionTone] = useState("success");
  const [verifOverrides, setVerifOverrides] = useState([]);
  const [verifOverridesLoading, setVerifOverridesLoading] = useState(false);

  const apiBase = import.meta.env.VITE_FILE_SERVER_URL || "http://localhost:3002";

  const getToken = useCallback(async () => {
    if (!currentUser) return null;
    return currentUser.getIdToken();
  }, [currentUser]);

  const loadVerifOverrides = useCallback(async () => {
    if (!currentUser) return;
    setVerifOverridesLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/admin/verification/overrides`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setVerifOverrides(data.overrides || []);
    } catch (_) {}
    setVerifOverridesLoading(false);
  }, [currentUser, apiBase, getToken]);

  useEffect(() => {
    if (activeTab === "verification") loadVerifOverrides();
  }, [activeTab, loadVerifOverrides]);

  const handleVerifLookup = async (e) => {
    e.preventDefault();
    if (!verifSearchEmail.trim()) return;
    setVerifLookupBusy(true);
    setVerifLookupResult(null);
    setVerifLookupError("");
    setVerifActionMsg("");
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/admin/verification/lookup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifSearchEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifLookupResult(data.user);
      } else {
        setVerifLookupError(data.error || "User not found");
      }
    } catch (_) {
      setVerifLookupError("Failed to contact server");
    }
    setVerifLookupBusy(false);
  };

  const handleVerifAction = async (action) => {
    if (!verifLookupResult) return;
    setVerifActionBusy(true);
    setVerifActionMsg("");
    try {
      const token = await getToken();
      const res = await fetch(
        `${apiBase}/api/admin/verification/${verifLookupResult.uid}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success) {
        setVerifActionTone("success");
        const labels = {
          "grant-email": "Email verification granted.",
          "revoke-email": "Email verification revoked.",
          "grant-discord": "Discord verification granted.",
          "revoke-discord": "Discord verification revoked.",
        };
        setVerifActionMsg(labels[action] || "Done.");
        // Re-lookup to refresh status
        const res2 = await fetch(`${apiBase}/api/admin/verification/lookup`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: verifLookupResult.email }),
        });
        const data2 = await res2.json();
        if (data2.success) setVerifLookupResult(data2.user);
        loadVerifOverrides();
      } else {
        setVerifActionTone("error");
        setVerifActionMsg(data.error || "Action failed.");
      }
    } catch (_) {
      setVerifActionTone("error");
      setVerifActionMsg("Failed to contact server.");
    }
    setVerifActionBusy(false);
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Extract unique action types and admins for filter dropdowns
  const uniqueActionTypes = useMemo(() => {
    const actions = new Set();
    adminLogs.forEach(log => {
      if (log.action.includes("Added")) actions.add("Added");
      if (log.action.includes("Removed")) actions.add("Removed");
      if (log.action.includes("Deleted")) actions.add("Deleted");
      if (log.action.includes("Uploaded")) actions.add("Uploaded");
      if (log.action.includes("Pinned")) actions.add("Pinned");
      if (log.action.includes("Unpinned")) actions.add("Unpinned");
    });
    return Array.from(actions).sort();
  }, [adminLogs]);

  const uniqueAdmins = useMemo(() => {
    const admins = new Set(adminLogs.map(log => log.adminEmail));
    return Array.from(admins).sort();
  }, [adminLogs]);

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    let filtered = [...adminLogs];

    // Search filter
    if (logSearchQuery) {
      const query = logSearchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.adminEmail.toLowerCase().includes(query)
      );
    }

    // Action type filter
    if (logFilterAction !== "all") {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(logFilterAction.toLowerCase())
      );
    }

    // Admin filter
    if (logFilterAdmin !== "all") {
      filtered = filtered.filter(log => log.adminEmail === logFilterAdmin);
    }

    // Date range filter
    if (logFilterDateRange !== "all" && filtered.length > 0) {
      const now = new Date();
      filtered = filtered.filter(log => {
        if (!log.timestamp) return false;
        const diff = now - log.timestamp;
        const hours = diff / 3600000;
        const days = diff / 86400000;

        switch (logFilterDateRange) {
          case "1h": return hours <= 1;
          case "24h": return hours <= 24;
          case "7d": return days <= 7;
          case "30d": return days <= 30;
          default: return true;
        }
      });
    }

    return filtered;
  }, [adminLogs, logSearchQuery, logFilterAction, logFilterAdmin, logFilterDateRange]);

  // Paginated logs
  const displayedLogs = filteredLogs.slice(0, logDisplayLimit);
  const hasMoreLogs = filteredLogs.length > logDisplayLimit;

  // Export to CSV function
  const exportLogsToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["Timestamp", "Action", "Details", "Admin Email"];
    const csvRows = [headers.join(",")];

    filteredLogs.forEach(log => {
      const row = [
        log.timestamp ? log.timestamp.toISOString() : "N/A",
        `"${log.action.replace(/"/g, '""')}"`,
        `"${log.details.replace(/"/g, '""')}"`,
        log.adminEmail
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <iconify-icon
                icon="solar:shield-user-linear"
                width="20"
                height="20"
                className="text-violet-400"
              ></iconify-icon>
            </div>
            <h1 className="text-2xl font-medium text-white">Admin Dashboard</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Manage administrators, view activity logs, and monitor site statistics.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="glass-panel rounded-2xl border border-white/10 p-2 mb-6 w-fit overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5">
            {[
              { id: "overview", label: "Overview", icon: "solar:chart-linear" },
              { id: "drops", label: "Drops", icon: "solar:box-linear" },
              { id: "events", label: "Events", icon: "solar:calendar-mark-linear" },
              { id: "tweaks", label: "Lurked Tweaks", icon: "solar:tuning-2-linear" },
              { id: "verification", label: "Verification", icon: "solar:shield-check-linear" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <iconify-icon icon={tab.icon} width="16" height="16"></iconify-icon>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <iconify-icon
                  icon="solar:users-group-rounded-linear"
                  width="20"
                  height="20"
                  className="text-violet-400"
                ></iconify-icon>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{adminStats.totalAdmins}</p>
                <p className="text-xs text-slate-500">Total Admins</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <iconify-icon
                  icon="solar:chat-round-line-linear"
                  width="20"
                  height="20"
                  className="text-blue-400"
                ></iconify-icon>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{adminStats.totalThreads}</p>
                <p className="text-xs text-slate-500">Forum Threads</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <iconify-icon
                  icon="solar:box-linear"
                  width="20"
                  height="20"
                  className="text-emerald-400"
                ></iconify-icon>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{adminStats.totalDrops}</p>
                <p className="text-xs text-slate-500">Total Drops</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Add Admin Form */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <iconify-icon
                  icon="solar:user-plus-linear"
                  width="16"
                  height="16"
                  className="text-violet-400"
                ></iconify-icon>
                Add New Admin
              </h2>
              <form onSubmit={onAddAdmin} className="space-y-3">
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={onAdminEmailInputChange}
                  placeholder="Enter email address"
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                  required
                />
                <button
                  type="submit"
                  disabled={adminBusy}
                  className="w-full rounded-xl bg-violet-500/20 border border-violet-500/30 px-5 py-3 text-sm font-semibold text-violet-300 transition-all duration-200 hover:bg-violet-500/30 hover:border-violet-400/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adminBusy ? (
                    <iconify-icon
                      icon="solar:refresh-circle-linear"
                      width="18"
                      height="18"
                      className="animate-spin"
                    ></iconify-icon>
                  ) : (
                    <>
                      <iconify-icon
                        icon="solar:user-plus-linear"
                        width="16"
                        height="16"
                      ></iconify-icon>
                      Add Admin
                    </>
                  )}
                </button>
              </form>

              {/* Message */}
              {adminMessage && (
                <div
                  className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl ${
                    adminMessageTone === "error"
                      ? "bg-rose-500/10 border border-rose-500/20"
                      : "bg-emerald-500/10 border border-emerald-500/20"
                  }`}
                >
                  <iconify-icon
                    icon={
                      adminMessageTone === "error"
                        ? "solar:danger-triangle-linear"
                        : "solar:check-circle-linear"
                    }
                    width="16"
                    height="16"
                    className={
                      adminMessageTone === "error"
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  ></iconify-icon>
                  <p
                    className={`text-sm ${
                      adminMessageTone === "error"
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {adminMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Current Admins List */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <iconify-icon
                  icon="solar:users-group-rounded-linear"
                  width="16"
                  height="16"
                  className="text-violet-400"
                ></iconify-icon>
                Current Admins
                <span className="ml-auto text-xs text-slate-500">
                  {adminEmails.length} {adminEmails.length === 1 ? "admin" : "admins"}
                </span>
              </h2>

              {adminEmails.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No admins configured.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {adminEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <iconify-icon
                            icon="solar:user-circle-linear"
                            width="16"
                            height="16"
                            className="text-violet-400"
                          ></iconify-icon>
                        </div>
                        <span className="text-sm text-white truncate">{email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveAdmin(email)}
                        disabled={adminBusy || adminEmails.length <= 1}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title={
                          adminEmails.length <= 1
                            ? "Cannot remove the last admin"
                            : "Remove admin"
                        }
                      >
                        <iconify-icon
                          icon="solar:trash-bin-trash-linear"
                          width="16"
                          height="16"
                        ></iconify-icon>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminEmails.length === 1 && (
                <p className="mt-4 text-xs text-slate-500 text-center">
                  At least one admin must remain.
                </p>
              )}
            </div>

          </div>

          {/* Right Column - Activity Logs */}
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <iconify-icon
                  icon="solar:clipboard-list-linear"
                  width="16"
                  height="16"
                  className="text-violet-400"
                ></iconify-icon>
                Activity Logs
                <span className="ml-2 text-xs text-slate-500">
                  ({filteredLogs.length})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {filteredLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={exportLogsToCSV}
                    disabled={adminBusy}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="Export to CSV"
                  >
                    <iconify-icon
                      icon="solar:download-minimalistic-linear"
                      width="14"
                      height="14"
                    ></iconify-icon>
                    Export
                  </button>
                )}
                {adminLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearLogs}
                    disabled={adminBusy}
                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                  >
                    Clear logs
                  </button>
                )}
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3 mb-4">
              {/* Search Bar */}
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-2 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
              />

              {/* Filter Row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Action Type Filter */}
                <select
                  value={logFilterAction}
                  onChange={(e) => setLogFilterAction(e.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                >
                  <option value="all">All Actions</option>
                  {uniqueActionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {/* Admin Filter */}
                <select
                  value={logFilterAdmin}
                  onChange={(e) => setLogFilterAdmin(e.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                >
                  <option value="all">All Admins</option>
                  {uniqueAdmins.map(admin => (
                    <option key={admin} value={admin}>{admin.split('@')[0]}</option>
                  ))}
                </select>

                {/* Date Range Filter */}
                <select
                  value={logFilterDateRange}
                  onChange={(e) => setLogFilterDateRange(e.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                >
                  <option value="all">All Time</option>
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              {/* Active Filters Indicator */}
              {(logSearchQuery || logFilterAction !== "all" || logFilterAdmin !== "all" || logFilterDateRange !== "all") && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Filters active:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLogSearchQuery("");
                      setLogFilterAction("all");
                      setLogFilterAdmin("all");
                      setLogFilterDateRange("all");
                      setLogDisplayLimit(20);
                    }}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {adminLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <iconify-icon
                  icon="solar:refresh-circle-linear"
                  width="24"
                  height="24"
                  className="text-violet-400 animate-spin"
                ></iconify-icon>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <iconify-icon
                  icon="solar:clipboard-list-linear"
                  width="32"
                  height="32"
                  className="text-slate-600 mx-auto mb-3"
                ></iconify-icon>
                <p className="text-sm text-slate-500">
                  {adminLogs.length === 0 ? "No activity logs yet." : "No logs match your filters."}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {adminLogs.length === 0
                    ? "Admin actions will appear here."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {displayedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 hover:bg-white/[0.05] transition-colors group"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${getActionColor(
                          log.action
                        )}`}
                      >
                        <iconify-icon
                          icon={getActionIcon(log.action)}
                          width="14"
                          height="14"
                        ></iconify-icon>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{sanitizeHTML(log.action)}</p>
                        {log.details && (
                          <p className="text-xs text-slate-400 break-words">
                            {sanitizeHTML(log.details)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-500 truncate">
                            by {log.adminEmail}
                          </p>
                          <span className="text-slate-600">•</span>
                          <p
                            className="text-[10px] text-slate-500"
                            title={log.timestamp ? log.timestamp.toLocaleString() : "Unknown"}
                          >
                            {formatTimestamp(log.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMoreLogs && (
                  <button
                    type="button"
                    onClick={() => setLogDisplayLimit(prev => prev + 20)}
                    className="w-full mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-all duration-200 hover:border-violet-400/40 hover:bg-violet-500/10"
                  >
                    Load More ({filteredLogs.length - logDisplayLimit} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
          </>
        )}

        {/* Drops Tab */}
        {activeTab === "drops" && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
              <iconify-icon
                icon="solar:box-linear"
                width="20"
                height="20"
                className="text-violet-400"
              ></iconify-icon>
              Drop Management
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Upload Drop Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <iconify-icon
                    icon="solar:upload-linear"
                    width="16"
                    height="16"
                    className="text-violet-400"
                  ></iconify-icon>
                  Upload New Drop
                </h3>

                <form onSubmit={onUploadDrop} className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      File (.txt only, max 50MB)
                    </label>
                    <div className="relative">
                      <input
                        id="drop-file-input"
                        type="file"
                        accept=".txt"
                        onChange={onDropFileChange}
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-500/20 file:text-violet-300 hover:file:bg-violet-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                      />
                    </div>
                    {dropUploadFile && (
                      <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                        <iconify-icon
                          icon="solar:check-circle-linear"
                          width="14"
                          height="14"
                        ></iconify-icon>
                        {dropUploadFile.name} ({(dropUploadFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={dropUploadTitle}
                      onChange={onDropUploadTitleChange}
                      placeholder="e.g., Netflix Premium"
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={dropUploadDescription}
                      onChange={onDropUploadDescriptionChange}
                      placeholder="Add details about this drop..."
                      rows={3}
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 resize-none"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Type
                    </label>
                    <select
                      value={dropUploadType}
                      onChange={onDropUploadTypeChange}
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                    >
                      <option value="account">Account</option>
                      <option value="combo">Combo</option>
                      <option value="config">Config</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={dropUploadBusy || !dropUploadFile}
                    className="w-full rounded-xl bg-violet-500/20 border border-violet-500/30 px-5 py-3 text-sm font-semibold text-violet-300 transition-all duration-200 hover:bg-violet-500/30 hover:border-violet-400/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {dropUploadBusy ? (
                      <>
                        <iconify-icon
                          icon="solar:refresh-circle-linear"
                          width="18"
                          height="18"
                          className="animate-spin"
                        ></iconify-icon>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <iconify-icon
                          icon="solar:upload-linear"
                          width="18"
                          height="18"
                        ></iconify-icon>
                        Upload Drop
                      </>
                    )}
                  </button>
                </form>

                {/* Upload Message */}
                {dropUploadMessage && (
                  <div
                    className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl ${
                      dropUploadMessageTone === "error"
                        ? "bg-rose-500/10 border border-rose-500/20"
                        : "bg-emerald-500/10 border border-emerald-500/20"
                    }`}
                  >
                    <iconify-icon
                      icon={
                        dropUploadMessageTone === "error"
                          ? "solar:danger-triangle-linear"
                          : "solar:check-circle-linear"
                      }
                      width="16"
                      height="16"
                      className={
                        dropUploadMessageTone === "error"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }
                    ></iconify-icon>
                    <p
                      className={`text-sm ${
                        dropUploadMessageTone === "error"
                          ? "text-rose-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {dropUploadMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Existing Drops List */}
              <div>
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <iconify-icon
                    icon="solar:list-linear"
                    width="16"
                    height="16"
                    className="text-violet-400"
                  ></iconify-icon>
                  Manage Existing Drops
                  <span className="ml-auto text-xs text-slate-500">
                    {drops?.length || 0} drops
                  </span>
                </h3>

                {dropsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <iconify-icon
                      icon="solar:refresh-circle-linear"
                      width="24"
                      height="24"
                      className="text-violet-400 animate-spin"
                    ></iconify-icon>
                  </div>
                ) : !drops || drops.length === 0 ? (
                  <div className="text-center py-12 rounded-xl bg-white/[0.03] border border-white/5">
                    <iconify-icon
                      icon="solar:box-linear"
                      width="32"
                      height="32"
                      className="text-slate-600 mx-auto mb-3"
                    ></iconify-icon>
                    <p className="text-sm text-slate-500">No drops available.</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Upload your first drop using the form.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {drops.map((drop) => (
                      <div
                        key={`${drop.id}-${drop.attachmentId || drop.fileName || drop.title}`}
                        className="flex items-start justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 group min-w-0"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-white font-medium break-words [overflow-wrap:anywhere]">
                              {sanitizeHTML(drop.title)}
                            </p>
                            <span className="max-w-[45%] text-[10px] uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-md flex-shrink-0 break-words text-right [overflow-wrap:anywhere]">
                              {sanitizeHTML(drop.type)}
                            </span>
                          </div>
                          {drop.description && (
                            <p className="text-xs text-slate-400 mt-0.5 break-words [overflow-wrap:anywhere]">
                              {sanitizeHTML(drop.description)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-500">
                              {drop.createdAt
                                ? drop.createdAt.toLocaleDateString()
                                : "Recently added"}
                            </p>
                            {drop.fileSize && (
                              <>
                                <span className="text-slate-600">•</span>
                                <p className="text-[10px] text-slate-500">
                                  {(drop.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteDrop(drop.id, drop.title)}
                          disabled={adminBusy}
                          className="opacity-0 group-hover:opacity-100 rounded-lg p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title="Delete drop"
                        >
                          <iconify-icon
                            icon="solar:trash-bin-trash-linear"
                            width="18"
                            height="18"
                          ></iconify-icon>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
              <iconify-icon
                icon="solar:calendar-mark-linear"
                width="20"
                height="20"
                className="text-amber-400"
              ></iconify-icon>
              Event Management
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Schedule Event Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <iconify-icon
                    icon="solar:add-circle-linear"
                    width="16"
                    height="16"
                    className="text-amber-400"
                  ></iconify-icon>
                  Schedule New Event
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUploadEvent();
                  }}
                  className="space-y-4"
                >
                  {/* Title */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventUploadTitle}
                      onChange={onEventUploadTitleChange}
                      placeholder="e.g., Movie Night: Inception"
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
                      required
                    />
                  </div>

                  {/* Date & Time */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={eventUploadDate}
                      onChange={onEventUploadDateChange}
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
                      required
                    />
                  </div>

                  {/* Genre */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Genre (optional)
                    </label>
                    <input
                      type="text"
                      value={eventUploadGenre}
                      onChange={onEventUploadGenreChange}
                      placeholder="e.g., Action, Comedy, Horror"
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={eventUploadBusy || !eventUploadTitle || !eventUploadDate}
                    className="w-full rounded-xl bg-amber-500/20 border border-amber-500/30 px-5 py-3 text-sm font-semibold text-amber-300 transition-all duration-200 hover:bg-amber-500/30 hover:border-amber-400/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {eventUploadBusy ? (
                      <>
                        <iconify-icon
                          icon="solar:refresh-circle-linear"
                          width="18"
                          height="18"
                          className="animate-spin"
                        ></iconify-icon>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <iconify-icon
                          icon="solar:calendar-add-linear"
                          width="18"
                          height="18"
                        ></iconify-icon>
                        Schedule Event
                      </>
                    )}
                  </button>
                </form>

                {/* Upload Message */}
                {eventUploadMessage && (
                  <div
                    className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl ${
                      eventUploadMessageTone === "error"
                        ? "bg-rose-500/10 border border-rose-500/20"
                        : "bg-emerald-500/10 border border-emerald-500/20"
                    }`}
                  >
                    <iconify-icon
                      icon={
                        eventUploadMessageTone === "error"
                          ? "solar:danger-triangle-linear"
                          : "solar:check-circle-linear"
                      }
                      width="16"
                      height="16"
                      className={
                        eventUploadMessageTone === "error"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }
                    ></iconify-icon>
                    <p
                      className={`text-sm ${
                        eventUploadMessageTone === "error"
                          ? "text-rose-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {eventUploadMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Existing Events List */}
              <div>
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <iconify-icon
                      icon="solar:inbox-line-linear"
                      width="16"
                      height="16"
                      className="text-cyan-400"
                    ></iconify-icon>
                    Movie Requests
                    <span className="ml-auto flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {movieRequests?.filter((request) => request.status === "open").length || 0} open
                      </span>
                      {movieRequests?.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearMovieRequests}
                          disabled={eventUploadBusy}
                          className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          Clear All
                        </button>
                      )}
                    </span>
                  </h3>

                  {movieRequestsLoading ? (
                    <div className="flex items-center justify-center py-10 rounded-xl bg-white/[0.03] border border-white/5">
                      <iconify-icon
                        icon="solar:refresh-circle-linear"
                        width="24"
                        height="24"
                        className="text-cyan-400 animate-spin"
                      ></iconify-icon>
                    </div>
                  ) : !movieRequests || movieRequests.length === 0 ? (
                    <div className="text-center py-10 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-sm text-slate-500">No movie requests yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[320px] overflow-y-auto mb-6">
                      {movieRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-xl bg-white/[0.03] border border-white/5 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm text-white font-medium">
                                  {sanitizeHTML(request.title)}
                                </p>
                                {request.year && (
                                  <span className="text-[10px] uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                                    {request.year}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                    request.status === "accepted"
                                      ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
                                      : request.status === "denied"
                                      ? "text-rose-300 border-rose-500/20 bg-rose-500/10"
                                      : "text-cyan-300 border-cyan-500/20 bg-cyan-500/10"
                                  }`}
                                >
                                  {request.status || "open"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {request.requesterTag || request.requesterName || request.requesterMention || "Unknown user"}
                                {" • "}
                                {request.createdAt
                                  ? new Date(request.createdAt).toLocaleString()
                                  : "Unknown time"}
                              </p>
                              {request.matchedMovie && (
                                <div className="mt-3 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3">
                                  <div className="flex gap-3">
                                    {request.matchedMovie.posterUrlSmall && (
                                      <img
                                        src={request.matchedMovie.posterUrlSmall}
                                        alt={request.matchedMovie.title || request.title}
                                        className="h-24 w-16 rounded-lg object-cover flex-shrink-0 border border-white/10"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-cyan-200">
                                        TMDb match: {sanitizeHTML(request.matchedMovie.title || request.title)}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                                        {request.matchedMovie.releaseDate && (
                                          <span>{sanitizeHTML(request.matchedMovie.releaseDate)}</span>
                                        )}
                                        {request.matchedMovie.runtime && (
                                          <span>{request.matchedMovie.runtime} min</span>
                                        )}
                                        {request.matchedMovie.voteAverage && (
                                          <span>Rating {request.matchedMovie.voteAverage}</span>
                                        )}
                                      </div>
                                      {request.matchedMovie.genres?.length > 0 && (
                                        <p className="mt-1 text-[11px] text-slate-400">
                                          {sanitizeHTML(request.matchedMovie.genres.join(", "))}
                                        </p>
                                      )}
                                      {request.matchedMovie.overview && (
                                        <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap break-words">
                                          {sanitizeHTML(request.matchedMovie.overview)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {request.details && (
                                <p className="text-xs text-slate-300 mt-3 whitespace-pre-wrap break-words">
                                  {sanitizeHTML(request.details)}
                                </p>
                              )}
                              {request.link && (
                                <a
                                  href={request.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 mt-2 break-all"
                                >
                                  <iconify-icon icon="solar:link-linear" width="14" height="14"></iconify-icon>
                                  {sanitizeHTML(request.link)}
                                </a>
                              )}
                              {request.adminNote && (
                                <p className="text-xs text-slate-400 mt-3">
                                  Admin note: {sanitizeHTML(request.adminNote)}
                                </p>
                              )}
                              {request.scheduledEventTitle && (
                                <p className="text-xs text-emerald-300 mt-2">
                                  Scheduled as: {sanitizeHTML(request.scheduledEventTitle)}
                                </p>
                              )}
                              {request.decisionDmSent === false && request.status !== "open" && (
                                <p className="text-xs text-amber-300 mt-2">
                                  Discord DM could not be delivered.
                                </p>
                              )}
                            </div>

                            {request.status === "open" && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onReviewMovieRequest(request, "accepted")}
                                  disabled={eventUploadBusy}
                                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onReviewMovieRequest(request, "denied")}
                                  disabled={eventUploadBusy}
                                  className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                  Deny
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <iconify-icon
                    icon="solar:list-linear"
                    width="16"
                    height="16"
                    className="text-amber-400"
                  ></iconify-icon>
                  Manage Scheduled Events
                  <span className="ml-auto text-xs text-slate-500">
                    {events?.filter(e => e.status === 'scheduled').length || 0} scheduled
                  </span>
                </h3>

                {eventsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <iconify-icon
                      icon="solar:refresh-circle-linear"
                      width="24"
                      height="24"
                      className="text-amber-400 animate-spin"
                    ></iconify-icon>
                  </div>
                ) : !events || events.filter(e => e.status === 'scheduled').length === 0 ? (
                  <div className="text-center py-12 rounded-xl bg-white/[0.03] border border-white/5">
                    <iconify-icon
                      icon="solar:calendar-linear"
                      width="32"
                      height="32"
                      className="text-slate-600 mx-auto mb-3"
                    ></iconify-icon>
                    <p className="text-sm text-slate-500">No events scheduled.</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Schedule your first event using the form.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {events
                      .filter(e => e.status === 'scheduled')
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 group"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white font-medium truncate">
                                {sanitizeHTML(event.title)}
                              </p>
                              {event.isLive && (
                                <span className="text-[10px] uppercase tracking-wider text-rose-400 bg-rose-500/20 border border-rose-400/30 px-2 py-0.5 rounded-md flex-shrink-0 animate-pulse">
                                  🔴 LIVE
                                </span>
                              )}
                              {event.genre && (
                                <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex-shrink-0">
                                  {sanitizeHTML(event.genre)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <iconify-icon
                                icon="solar:calendar-linear"
                                width="12"
                                height="12"
                                className="text-slate-500"
                              ></iconify-icon>
                              <p className="text-[10px] text-slate-500">
                                {event.dateFormatted || new Date(event.date).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Set Live Button */}
                            <button
                              type="button"
                              onClick={() => onToggleEventLive(event.id, event.title, !event.isLive)}
                              disabled={eventUploadBusy}
                              className={`opacity-0 group-hover:opacity-100 rounded-lg p-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                                event.isLive
                                  ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-400/20'
                                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-400/20'
                              }`}
                              title={event.isLive ? "Set not live" : "Set live"}
                            >
                              <iconify-icon
                                icon={event.isLive ? "solar:pause-circle-linear" : "solar:play-circle-linear"}
                                width="18"
                                height="18"
                              ></iconify-icon>
                            </button>
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => onDeleteEvent(event.id, event.title)}
                              disabled={eventUploadBusy}
                              className="opacity-0 group-hover:opacity-100 rounded-lg p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              title="Delete event"
                            >
                              <iconify-icon
                                icon="solar:trash-bin-trash-linear"
                                width="18"
                                height="18"
                              ></iconify-icon>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Lurked Tweaks Tab */}
        {activeTab === "tweaks" && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
              <iconify-icon
                icon="solar:tuning-2-linear"
                width="20"
                height="20"
                className="text-cyan-400"
              ></iconify-icon>
              Lurked Tweaks
            </h2>

            <div className="max-w-xl">
              <p className="text-sm text-slate-400 mb-6">
                Upload the Lurked Tweaks .zip file. This will be hosted on the server and available for download on the homepage.
              </p>

              {/* Current File Info */}
              {lurkedTweaksInfo && (
                <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.03] border border-white/5 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <iconify-icon
                      icon="solar:zip-file-linear"
                      width="20"
                      height="20"
                      className="text-cyan-400"
                    ></iconify-icon>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{lurkedTweaksInfo.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">
                        {(lurkedTweaksInfo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <span className="text-slate-600">•</span>
                      <p className="text-xs text-slate-500">
                        Uploaded {new Date(lurkedTweaksInfo.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md flex-shrink-0">
                    Live
                  </span>
                </div>
              )}

              <form onSubmit={onUploadLurkedTweaks} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    File (.zip only, max 200MB)
                  </label>
                  <input
                    id="tweaks-file-input"
                    type="file"
                    accept=".zip"
                    onChange={onLurkedTweaksFileChange}
                    className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40"
                  />
                  {lurkedTweaksFile && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                      <iconify-icon
                        icon="solar:check-circle-linear"
                        width="14"
                        height="14"
                      ></iconify-icon>
                      {lurkedTweaksFile.name} ({(lurkedTweaksFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={lurkedTweaksBusy || !lurkedTweaksFile}
                  className="w-full rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-5 py-3 text-sm font-semibold text-cyan-300 transition-all duration-200 hover:bg-cyan-500/30 hover:border-cyan-400/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {lurkedTweaksBusy ? (
                    <>
                      <iconify-icon
                        icon="solar:refresh-circle-linear"
                        width="18"
                        height="18"
                        className="animate-spin"
                      ></iconify-icon>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <iconify-icon
                        icon="solar:upload-linear"
                        width="18"
                        height="18"
                      ></iconify-icon>
                      {lurkedTweaksInfo ? "Replace File" : "Upload File"}
                    </>
                  )}
                </button>
              </form>

              {lurkedTweaksMessage && (
                <div
                  className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl ${
                    lurkedTweaksMessageTone === "error"
                      ? "bg-rose-500/10 border border-rose-500/20"
                      : "bg-emerald-500/10 border border-emerald-500/20"
                  }`}
                >
                  <iconify-icon
                    icon={
                      lurkedTweaksMessageTone === "error"
                        ? "solar:danger-triangle-linear"
                        : "solar:check-circle-linear"
                    }
                    width="16"
                    height="16"
                    className={
                      lurkedTweaksMessageTone === "error"
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  ></iconify-icon>
                  <p
                    className={`text-sm ${
                      lurkedTweaksMessageTone === "error"
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {lurkedTweaksMessage}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Verification Management Tab */}
        {activeTab === "verification" && (
          <div className="space-y-6">
            {/* Lookup Card */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-medium text-white mb-1 flex items-center gap-2">
                <iconify-icon icon="solar:shield-check-linear" width="20" height="20" className="text-violet-400"></iconify-icon>
                Verification Management
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Look up a user by email to grant or revoke email / Discord verification status.
              </p>

              <form onSubmit={handleVerifLookup} className="flex gap-3 mb-6">
                <input
                  type="email"
                  value={verifSearchEmail}
                  onChange={(e) => setVerifSearchEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 rounded-xl bg-black/60 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                  required
                />
                <button
                  type="submit"
                  disabled={verifLookupBusy}
                  className="rounded-xl bg-violet-500/20 border border-violet-500/30 px-5 py-2.5 text-sm font-medium text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {verifLookupBusy ? (
                    <iconify-icon icon="solar:refresh-circle-linear" width="16" height="16" className="animate-spin"></iconify-icon>
                  ) : (
                    <iconify-icon icon="solar:magnifer-linear" width="16" height="16"></iconify-icon>
                  )}
                  Look up
                </button>
              </form>

              {verifLookupError && (
                <p className="text-sm text-rose-400 mb-4">{verifLookupError}</p>
              )}

              {verifLookupResult && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-5">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    {verifLookupResult.photoURL ? (
                      <img src={verifLookupResult.photoURL} className="w-10 h-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                        <iconify-icon icon="solar:user-linear" width="18" height="18" className="text-violet-400"></iconify-icon>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{verifLookupResult.displayName || verifLookupResult.email}</p>
                      <p className="text-xs text-slate-500">{verifLookupResult.uid}</p>
                    </div>
                  </div>

                  {/* Status Rows */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email Verification */}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email Verified</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          verifLookupResult.emailVerified
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                        }`}>
                          {verifLookupResult.emailVerified ? "Verified" : "Not verified"}
                        </span>
                      </div>
                      {verifLookupResult.emailAdminGranted && (
                        <p className="text-[10px] text-amber-400">
                          Admin granted by {verifLookupResult.emailGrantedBy}
                          {verifLookupResult.emailGrantedAt && ` · ${new Date(verifLookupResult.emailGrantedAt).toLocaleDateString()}`}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerifAction("grant-email")}
                          disabled={verifActionBusy || verifLookupResult.emailVerified}
                          className="flex-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Grant
                        </button>
                        <button
                          onClick={() => handleVerifAction("revoke-email")}
                          disabled={verifActionBusy || !verifLookupResult.emailVerified}
                          className="flex-1 rounded-lg bg-rose-500/15 border border-rose-500/25 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>

                    {/* Discord Verification */}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Discord Linked</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          verifLookupResult.discordLinked
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                        }`}>
                          {verifLookupResult.discordLinked
                            ? (verifLookupResult.discordAdminGranted ? "Granted" : `@${verifLookupResult.discordUsername || "linked"}`)
                            : "Not linked"}
                        </span>
                      </div>
                      {verifLookupResult.discordAdminGranted && (
                        <p className="text-[10px] text-amber-400">
                          Admin granted by {verifLookupResult.discordGrantedBy}
                          {verifLookupResult.discordGrantedAt && ` · ${new Date(verifLookupResult.discordGrantedAt).toLocaleDateString()}`}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerifAction("grant-discord")}
                          disabled={verifActionBusy || (verifLookupResult.discordLinked && !verifLookupResult.discordAdminGranted)}
                          className="flex-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Grant
                        </button>
                        <button
                          onClick={() => handleVerifAction("revoke-discord")}
                          disabled={verifActionBusy || !verifLookupResult.discordLinked}
                          className="flex-1 rounded-lg bg-rose-500/15 border border-rose-500/25 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action feedback */}
                  {verifActionMsg && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                      verifActionTone === "error"
                        ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                        : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    }`}>
                      <iconify-icon
                        icon={verifActionTone === "error" ? "solar:danger-triangle-linear" : "solar:check-circle-linear"}
                        width="16" height="16"
                      ></iconify-icon>
                      {verifActionMsg}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Overrides List */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-medium text-white flex items-center gap-2">
                  <iconify-icon icon="solar:users-group-two-rounded-linear" width="18" height="18" className="text-amber-400"></iconify-icon>
                  Admin-Granted Verifications
                  {verifOverrides.length > 0 && (
                    <span className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {verifOverrides.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={loadVerifOverrides}
                  disabled={verifOverridesLoading}
                  className="text-slate-500 hover:text-white transition-colors"
                  title="Refresh"
                >
                  <iconify-icon
                    icon="solar:refresh-linear"
                    width="16" height="16"
                    className={verifOverridesLoading ? "animate-spin" : ""}
                  ></iconify-icon>
                </button>
              </div>

              {verifOverridesLoading ? (
                <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>
              ) : verifOverrides.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-sm">No admin-granted verifications yet.</div>
              ) : (
                <div className="space-y-3">
                  {verifOverrides.map((ov) => (
                    <div key={ov.uid} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                        <iconify-icon icon="solar:user-linear" width="14" height="14" className="text-violet-400"></iconify-icon>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ov.email || ov.uid}</p>
                        <p className="text-[10px] text-slate-600 font-mono truncate">{ov.uid}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ov.emailGranted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Email
                          </span>
                        )}
                        {ov.discordGranted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            Discord
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setVerifSearchEmail(ov.email || "");
                            setVerifLookupResult(null);
                            setVerifActionMsg("");
                          }}
                          className="text-slate-600 hover:text-violet-400 transition-colors ml-1"
                          title="Load this user"
                        >
                          <iconify-icon icon="solar:arrow-right-linear" width="14" height="14"></iconify-icon>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

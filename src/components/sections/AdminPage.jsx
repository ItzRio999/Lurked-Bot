import { sanitizeHTML } from "../../utils/sanitize";

export default function AdminPage({
  activePage,
  isAdmin,
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
              </h2>
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

            {adminLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <iconify-icon
                  icon="solar:refresh-circle-linear"
                  width="24"
                  height="24"
                  className="text-violet-400 animate-spin"
                ></iconify-icon>
              </div>
            ) : adminLogs.length === 0 ? (
              <div className="text-center py-12">
                <iconify-icon
                  icon="solar:clipboard-list-linear"
                  width="32"
                  height="32"
                  className="text-slate-600 mx-auto mb-3"
                ></iconify-icon>
                <p className="text-sm text-slate-500">No activity logs yet.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Admin actions will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {adminLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3"
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
                        <p className="text-xs text-slate-400 truncate">
                          {sanitizeHTML(log.details)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 truncate">
                          by {log.adminEmail}
                        </p>
                        <span className="text-slate-600">•</span>
                        <p className="text-[10px] text-slate-500">
                          {formatTimestamp(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drops Management Section */}
        <div className="mt-8">
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
                        key={drop.id}
                        className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 group"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium truncate">
                              {sanitizeHTML(drop.title)}
                            </p>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-md flex-shrink-0">
                              {sanitizeHTML(drop.type)}
                            </span>
                          </div>
                          {drop.description && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
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
        </div>

        {/* Event Management Section */}
        <div className="mt-8">
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
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

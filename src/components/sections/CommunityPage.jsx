import { useState, useMemo, useEffect } from "react";
import { sanitizeHTML } from "../../utils/sanitize";

const DROPS_PER_PAGE = 12;

export default function CommunityPage({
  activePage,
  isVerified,
  communityGateMessage,
  currentUser,
  onAuthOpen,
  authButtonClass,
  authPrimaryButtonClass,
  onVerifyEmail,
  profileBusy,
  isAdmin,
  onDropSubmit,
  dropTitle,
  onDropTitleChange,
  dropType,
  onDropTypeChange,
  onDropFileChange,
  dropDescription,
  onDropDescriptionChange,
  dropMessage,
  dropBusy,
  dropsLoading,
  dropsError,
  drops,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(drops.length / DROPS_PER_PAGE);
  const paginatedDrops = useMemo(() => {
    const startIndex = (currentPage - 1) * DROPS_PER_PAGE;
    return drops.slice(startIndex, startIndex + DROPS_PER_PAGE);
  }, [drops, currentPage]);

  // Reset to page 1 when drops change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [drops.length, currentPage, totalPages]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of drops section
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <section
      className="page relative z-10 py-28"
      data-page="community"
      hidden={activePage !== "community"}
    >
      <div className="max-w-6xl mx-auto px-6">
        {!isVerified ? (
          <div className="opacity-0 animate-fade-in-scale glass-panel p-12 rounded-3xl text-center">
            <div className="inline-flex items-center justify-center mb-8 h-16 w-16 rounded-2xl border border-white/10 bg-white/5 transition-all duration-300 hover:scale-110 hover:bg-violet-500/10 hover:border-violet-400/30">
              <iconify-icon
                icon="solar:lock-keyhole-linear"
                width="32"
                height="32"
                className="text-violet-300"
              ></iconify-icon>
            </div>
            <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
              Drops are locked
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
              {communityGateMessage ||
                "Sign in and verify your email to unlock Drops."}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {!currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={onAuthOpen("signin")}
                    className={authButtonClass}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={onAuthOpen("signup")}
                    className={authPrimaryButtonClass}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onVerifyEmail}
                  disabled={profileBusy || currentUser.emailVerified}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-violet-400/60 hover:bg-violet-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <iconify-icon
                    icon="solar:letter-linear"
                    width="18"
                    height="18"
                  ></iconify-icon>
                  {currentUser.emailVerified
                    ? "Email verified"
                    : "Send verification"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div className="opacity-0 animate-fade-in-up mb-14">
              <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
                Exclusive Content
              </p>
              <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
                Drop Page
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl">
                Admin drops for accounts, software, keys, and more.
              </p>
            </div>

            {/* Admin Upload Section */}
            {isAdmin && (
              <div className="opacity-0 animate-fade-in-up delay-100 glass-panel p-8 rounded-3xl mb-10 relative overflow-hidden">
                <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-violet-600/15 blur-[100px] animate-breathe"></div>
                <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-indigo-600/15 blur-[100px] animate-breathe-slow"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">
                      Admin Console
                    </p>
                    <h3 className="text-2xl font-medium text-white">
                      Upload a new drop
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Admin only
                  </span>
                </div>

                <form
                  onSubmit={onDropSubmit}
                  className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                  <label className="block text-sm text-slate-300 md:col-span-2">
                    <span className="mb-2 flex items-center gap-2">
                      <iconify-icon
                        icon="solar:text-linear"
                        width="14"
                        height="14"
                        className="text-slate-500"
                      ></iconify-icon>
                      Title
                    </span>
                    <input
                      type="text"
                      value={dropTitle}
                      onChange={onDropTitleChange}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                      placeholder="Drop title"
                      maxLength={80}
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 flex items-center gap-2">
                      <iconify-icon
                        icon="solar:tag-linear"
                        width="14"
                        height="14"
                        className="text-slate-500"
                      ></iconify-icon>
                      Type
                    </span>
                    <select
                      value={dropType}
                      onChange={onDropTypeChange}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                    >
                      <option value="account">Account</option>
                      <option value="script">Script</option>
                      <option value="exe">Exe</option>
                      <option value="key">Key</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 flex items-center gap-2">
                      <iconify-icon
                        icon="solar:file-linear"
                        width="14"
                        height="14"
                        className="text-slate-500"
                      ></iconify-icon>
                      File
                    </span>
                    <input
                      type="file"
                      onChange={onDropFileChange}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white transition-all duration-200 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white file:transition-colors hover:file:bg-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </label>
                  <label className="block text-sm text-slate-300 md:col-span-2">
                    <span className="mb-2 flex items-center gap-2">
                      <iconify-icon
                        icon="solar:document-text-linear"
                        width="14"
                        height="14"
                        className="text-slate-500"
                      ></iconify-icon>
                      Description
                    </span>
                    <textarea
                      value={dropDescription}
                      onChange={onDropDescriptionChange}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 resize-none"
                      placeholder="Short description"
                      rows={3}
                      maxLength={240}
                    ></textarea>
                  </label>
                  <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {dropMessage && (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <iconify-icon
                          icon="solar:info-circle-linear"
                          width="16"
                          height="16"
                          className="text-violet-400"
                        ></iconify-icon>
                        {dropMessage}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={dropBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-white via-slate-100 to-white text-black px-6 py-3 text-sm font-semibold shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <iconify-icon
                        icon="solar:upload-minimalistic-linear"
                        width="18"
                        height="18"
                      ></iconify-icon>
                      {dropBusy ? "Uploading..." : "Upload drop"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Loading State */}
            {dropsLoading ? (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center">
                <div className="inline-flex items-center gap-3 text-slate-400">
                  <iconify-icon
                    icon="solar:refresh-circle-linear"
                    width="24"
                    height="24"
                    className="animate-spin-slow"
                  ></iconify-icon>
                  Loading drops...
                </div>
              </div>
            ) : dropsError ? (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center border-rose-500/20">
                <iconify-icon
                  icon="solar:danger-triangle-linear"
                  width="32"
                  height="32"
                  className="text-rose-400 mb-3"
                ></iconify-icon>
                <p className="text-rose-400">{dropsError}</p>
              </div>
            ) : drops.length === 0 ? (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center">
                <iconify-icon
                  icon="solar:box-minimalistic-linear"
                  width="40"
                  height="40"
                  className="text-slate-500 mb-4"
                ></iconify-icon>
                <p className="text-slate-400">
                  No drops available yet. Check back soon.
                </p>
              </div>
            ) : (
              <>
                {/* Drops count and page info */}
                <div className="flex items-center justify-between mb-6 text-sm text-slate-400">
                  <span>
                    Showing {(currentPage - 1) * DROPS_PER_PAGE + 1}-
                    {Math.min(currentPage * DROPS_PER_PAGE, drops.length)} of{" "}
                    {drops.length} drops
                  </span>
                  {totalPages > 1 && (
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>

                {/* Drops Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedDrops.map((drop, index) => (
                    <div
                      key={drop.id}
                      className="glass-panel p-6 rounded-2xl flex flex-col gap-4 group card-hover"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">
                            {sanitizeHTML(drop.type)}
                          </p>
                          <h3 className="text-xl font-medium text-white transition-colors duration-300 group-hover:text-violet-200">
                            {sanitizeHTML(drop.title)}
                          </h3>
                        </div>
                      </div>
                      {drop.description && (
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {sanitizeHTML(drop.description)}
                        </p>
                      )}

                      {/* Download Button */}
                      {drop.id ? (
                        <a
                          href={`${import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002'}/api/download/${drop.id}`}
                          download={drop.fileName || `${sanitizeHTML(drop.title)}.txt`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/download w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-300 transition-all duration-200 hover:bg-violet-500/20 hover:border-violet-400/50 hover:text-violet-200 active:scale-[0.98]"
                        >
                          <iconify-icon
                            icon="solar:download-minimalistic-bold"
                            width="18"
                            height="18"
                            class="transition-transform duration-200 group-hover/download:translate-y-0.5"
                          ></iconify-icon>
                          Download
                        </a>
                      ) : (
                        <button
                          disabled
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed"
                        >
                          <iconify-icon
                            icon="solar:download-minimalistic-linear"
                            width="18"
                            height="18"
                          ></iconify-icon>
                          No file available
                        </button>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
                        <span className="flex items-center gap-2">
                          <iconify-icon
                            icon="solar:calendar-linear"
                            width="14"
                            height="14"
                          ></iconify-icon>
                          {drop.createdAt
                            ? drop.createdAt.toLocaleDateString()
                            : "Recently added"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.15em]">
                          {sanitizeHTML(drop.type)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    {/* Previous Button */}
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:border-violet-400/60 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-white/5"
                    >
                      <iconify-icon
                        icon="solar:arrow-left-linear"
                        width="16"
                        height="16"
                      ></iconify-icon>
                      Prev
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first, last, current, and adjacent pages
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, arr) => {
                          // Add ellipsis if there's a gap
                          const showEllipsisBefore =
                            index > 0 && page - arr[index - 1] > 1;
                          return (
                            <span key={page} className="flex items-center">
                              {showEllipsisBefore && (
                                <span className="px-2 text-slate-500">...</span>
                              )}
                              <button
                                onClick={() => goToPage(page)}
                                className={`h-10 w-10 rounded-full text-sm font-medium transition-all duration-200 ${
                                  currentPage === page
                                    ? "bg-violet-500/30 border border-violet-400/60 text-white"
                                    : "border border-white/10 bg-white/5 text-slate-400 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                                }`}
                              >
                                {page}
                              </button>
                            </span>
                          );
                        })}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:border-violet-400/60 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-white/5"
                    >
                      Next
                      <iconify-icon
                        icon="solar:arrow-right-linear"
                        width="16"
                        height="16"
                      ></iconify-icon>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

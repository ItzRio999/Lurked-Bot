export default function NavBar({
  LurkedLogo,
  DiscordLogo,
  navItems,
  pageLabels,
  navLinkClass,
  onNav,
  currentUser,
  welcomeName,
  profileOpen,
  profileMenuRef,
  profileMessage,
  profileBusy,
  usernameInput,
  onUsernameInputChange,
  onProfileToggle,
  onVerifyEmail,
  onPasswordReset,
  onUsernameSave,
  onSignOut,
  onAuthOpen,
  authButtonClass,
  authPrimaryButtonClass,
  isAdmin,
}) {
  const visibleNavItems = navItems.filter(
    (item) => item !== "admin" || isAdmin
  );
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.08] bg-black/50 backdrop-blur-2xl shadow-lg shadow-black/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#home"
          className="group flex items-center gap-3 transition-opacity duration-200 hover:opacity-90"
          aria-label="LurkedAccounts home"
          onClick={onNav("home")}
        >
          <img
            src={LurkedLogo}
            alt="LurkedAccounts Logo"
            className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            height="40"
          />
          <span className="text-lg font-medium tracking-tight text-shimmer hidden sm:block">
            LurkedAccounts
          </span>
        </a>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          {visibleNavItems.map((item) => (
            <a
              key={item}
              href={`#${item}`}
              className={navLinkClass(item)}
              onClick={onNav(item)}
            >
              {pageLabels[item]}
            </a>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="hidden md:flex items-center gap-3 relative">
          {/* Discord Link */}
          <a
            href="https://discord.gg/zTUpkK9JCx"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-2 text-xs font-semibold text-white transition-all duration-200 hover:border-violet-400/50 hover:bg-violet-500/15 hover:shadow-lg hover:shadow-violet-500/10 hover:scale-[1.02] active:scale-[0.98]"
          >
            <img
              src={DiscordLogo}
              alt=""
              className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
              width="16"
              height="16"
              loading="lazy"
            />
            <span>Join Discord</span>
            <iconify-icon
              icon="solar:arrow-right-linear"
              width="14"
              height="14"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            ></iconify-icon>
          </a>

          {/* User Menu */}
          {currentUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={onProfileToggle}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:border-violet-400/50 hover:bg-violet-500/15 hover:shadow-lg hover:shadow-violet-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 active:scale-[0.98]"
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/10 text-violet-300 transition-all duration-200 group-hover:border-violet-400/60 group-hover:bg-violet-500/30 group-hover:scale-105">
                  <iconify-icon
                    icon="solar:user-circle-linear"
                    width="16"
                    height="16"
                  ></iconify-icon>
                </span>
                <span className="max-w-[120px] truncate">
                  {welcomeName || "Profile"}
                </span>
                <iconify-icon
                  icon="solar:alt-arrow-down-linear"
                  width="14"
                  height="14"
                  className={`transition-transform duration-200 ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                ></iconify-icon>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-black/90 backdrop-blur-2xl shadow-2xl shadow-violet-500/5 animate-fade-in-scale">
                  {/* Decorative glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-violet-500/10 blur-[60px] rounded-full pointer-events-none" />

                  {/* User Info Header */}
                  <div className="relative px-5 py-5 border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center">
                          <iconify-icon
                            icon="solar:user-circle-bold"
                            width="28"
                            height="28"
                            className="text-violet-300"
                          ></iconify-icon>
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                            currentUser.emailVerified
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {welcomeName || "User"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {currentUser.email || "Unknown email"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Content */}
                  <div className="relative px-4 py-4 space-y-3">
                    {/* Account Section */}
                    <div className="space-y-1">
                      <p className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">
                        Account
                      </p>

                      {/* Email Status */}
                      <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                              currentUser.emailVerified
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                            }`}
                          >
                            <iconify-icon
                              icon={
                                currentUser.emailVerified
                                  ? "solar:verified-check-linear"
                                  : "solar:shield-warning-linear"
                              }
                              width="14"
                              height="14"
                            ></iconify-icon>
                          </span>
                          <div>
                            <p className="text-xs text-white font-medium">Email Status</p>
                            <p className={`text-[10px] ${
                              currentUser.emailVerified
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}>
                              {currentUser.emailVerified ? "Verified" : "Pending verification"}
                            </p>
                          </div>
                        </div>
                        {!currentUser.emailVerified && (
                          <button
                            type="button"
                            onClick={onVerifyEmail}
                            disabled={profileBusy}
                            className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                          >
                            Verify
                          </button>
                        )}
                      </div>

                      {/* User ID */}
                      <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400">
                          <iconify-icon
                            icon="solar:fingerprint-scan-linear"
                            width="14"
                            height="14"
                          ></iconify-icon>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium">User ID</p>
                          <p className="text-[10px] text-slate-500 truncate font-mono">
                            {currentUser.uid}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="space-y-1">
                      <p className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">
                        Settings
                      </p>

                      {/* Username Change */}
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <iconify-icon
                            icon="solar:pen-new-square-linear"
                            width="12"
                            height="12"
                            className="text-slate-500"
                          ></iconify-icon>
                          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-medium">
                            Username
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={onUsernameInputChange}
                            className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40"
                            placeholder="New username"
                            maxLength={35}
                          />
                          <button
                            type="button"
                            onClick={onUsernameSave}
                            disabled={profileBusy}
                            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 transition-all duration-200 hover:bg-violet-500/20 hover:border-violet-400/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                        {profileMessage && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-300">
                            <iconify-icon
                              icon="solar:check-circle-linear"
                              width="12"
                              height="12"
                            ></iconify-icon>
                            {profileMessage}
                          </div>
                        )}
                      </div>

                      {/* Password Reset */}
                      <button
                        type="button"
                        onClick={onPasswordReset}
                        disabled={profileBusy}
                        className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 group"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors group-hover:text-violet-400 group-hover:border-violet-500/30 group-hover:bg-violet-500/10">
                          <iconify-icon
                            icon="solar:key-linear"
                            width="14"
                            height="14"
                          ></iconify-icon>
                        </span>
                        <div>
                          <p className="text-xs text-white font-medium">Change Password</p>
                          <p className="text-[10px] text-slate-500">Send reset link to email</p>
                        </div>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Sign Out */}
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-300 active:scale-[0.98] group"
                    >
                      <iconify-icon
                        icon="solar:logout-2-linear"
                        width="16"
                        height="16"
                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                      ></iconify-icon>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
          )}
        </div>

        {/* Mobile Menu Button (placeholder for future mobile nav) */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white transition-all duration-200 hover:bg-white/10 active:scale-95"
          aria-label="Open menu"
        >
          <iconify-icon
            icon="solar:hamburger-menu-linear"
            width="20"
            height="20"
          ></iconify-icon>
        </button>
      </div>
    </nav>
  );
}

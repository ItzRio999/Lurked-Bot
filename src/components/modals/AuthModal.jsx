import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "../../utils/auth";

export default function AuthModal({
  authMode,
  authEmail,
  onAuthEmailChange,
  authPassword,
  onAuthPasswordChange,
  authError,
  authNotice,
  authBusy,
  onClose,
  onSubmit,
  onPasswordReset,
}) {
  if (!authMode) {
    return null;
  }

  const isSignUp = authMode === "signup";
  const authTitle = isSignUp ? "Create account" : "Sign in";
  const authSubtitle = isSignUp
    ? "Join the community and start connecting."
    : "Welcome back to LurkedAccounts.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 relative border border-white/10 animate-fade-in">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          aria-label="Close"
        >
          <iconify-icon icon="solar:close-circle-linear" width="20" height="20"></iconify-icon>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <iconify-icon
              icon={isSignUp ? "solar:user-plus-linear" : "solar:login-2-linear"}
              width="24"
              height="24"
              className="text-violet-400"
            ></iconify-icon>
          </div>
          <h3 className="text-2xl font-medium text-white mb-1">{authTitle}</h3>
          <p className="text-sm text-slate-400">{authSubtitle}</p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <iconify-icon
                icon="solar:letter-linear"
                width="14"
                height="14"
                className="text-slate-500"
              ></iconify-icon>
              Email
            </label>
            <input
              type="email"
              required
              value={authEmail}
              onChange={onAuthEmailChange}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={MAX_EMAIL_LENGTH}
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <iconify-icon
                icon="solar:lock-password-linear"
                width="14"
                height="14"
                className="text-slate-500"
              ></iconify-icon>
              Password
            </label>
            <input
              type="password"
              required
              value={authPassword}
              onChange={onAuthPasswordChange}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
              placeholder="Enter your password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
              maxLength={MAX_PASSWORD_LENGTH}
            />
          </div>

          {/* Error message */}
          {authError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <iconify-icon
                icon="solar:danger-triangle-linear"
                width="16"
                height="16"
                className="text-rose-400 flex-shrink-0"
              ></iconify-icon>
              <p className="text-sm text-rose-300">{authError}</p>
            </div>
          )}

          {/* Success notice */}
          {authNotice && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <iconify-icon
                icon="solar:check-circle-linear"
                width="16"
                height="16"
                className="text-emerald-400 flex-shrink-0"
              ></iconify-icon>
              <p className="text-sm text-emerald-300">{authNotice}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={authBusy}
            className="w-full rounded-xl bg-gradient-to-r from-white via-slate-100 to-white text-black px-4 py-3 text-sm font-semibold shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy ? (
              <span className="flex items-center justify-center gap-2">
                <iconify-icon
                  icon="solar:refresh-circle-linear"
                  width="18"
                  height="18"
                  className="animate-spin"
                ></iconify-icon>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <iconify-icon
                  icon={isSignUp ? "solar:user-plus-linear" : "solar:login-2-linear"}
                  width="18"
                  height="18"
                ></iconify-icon>
                {authTitle}
              </span>
            )}
          </button>

          {/* Forgot password link */}
          {authMode === "signin" && (
            <button
              type="button"
              onClick={onPasswordReset}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition-colors py-2"
            >
              <iconify-icon
                icon="solar:key-linear"
                width="14"
                height="14"
              ></iconify-icon>
              Forgot password? Send reset link
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ========================================
// Button Class System - Consistent Button Styles
// ========================================

// Base styles shared across all buttons
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

// ========================================
// Primary Buttons - Main CTAs
// ========================================

// Primary button (white/light)
const primaryButtonClass = `${buttonBase} bg-white text-black px-6 py-3 text-sm hover:bg-slate-100 hover:shadow-lg hover:shadow-violet-500/10`;

// Primary button with gradient
const primaryGradientButtonClass = `${buttonBase} border border-violet-400/40 bg-gradient-to-r from-white via-slate-100 to-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-violet-500/10 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30`;

// Primary large
const primaryLargeButtonClass = `${buttonBase} bg-white text-black px-8 py-4 text-base hover:bg-slate-100 hover:shadow-lg hover:shadow-violet-500/10 hover:scale-[1.02]`;

// ========================================
// Secondary Buttons - Ghost/Outline styles
// ========================================

// Secondary outline button
const secondaryButtonClass = `${buttonBase} border border-white/10 bg-white/5 px-6 py-3 text-sm text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

// Secondary outline large
const secondaryLargeButtonClass = `${buttonBase} border border-white/20 bg-transparent px-8 py-4 text-base text-white hover:bg-white/5 hover:border-white/30`;

// ========================================
// Auth Buttons - Sign in/Sign up
// ========================================

const authButtonClass = `${buttonBase} border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

const authPrimaryButtonClass = `${buttonBase} border border-violet-400/40 bg-gradient-to-r from-white via-slate-100 to-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-violet-500/10 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30`;

// ========================================
// Small Buttons - Compact actions
// ========================================

const smallButtonClass = `${buttonBase} border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

const smallPrimaryButtonClass = `${buttonBase} border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:border-violet-400/60 hover:bg-violet-500/30`;

// ========================================
// Danger Buttons - Destructive actions
// ========================================

const dangerButtonClass = `${buttonBase} border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:border-rose-300/60 hover:bg-rose-500/20`;

const dangerSmallButtonClass = `${buttonBase} border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:border-rose-500/60 hover:bg-rose-500/20`;

// ========================================
// Success Buttons - Positive actions
// ========================================

const successButtonClass = `${buttonBase} border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-500/20`;

// ========================================
// Icon Buttons - Square icon-only buttons
// ========================================

const iconButtonClass = `${buttonBase} p-2 border border-white/10 bg-white/5 text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

const iconButtonSmallClass = `${buttonBase} p-1.5 border border-white/10 bg-white/5 text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

// ========================================
// Form Buttons - Submit/Action in forms
// ========================================

const formSubmitButtonClass = `${buttonBase} w-full bg-gradient-to-r from-white via-slate-100 to-white text-black px-4 py-3 text-sm font-semibold shadow-lg shadow-violet-500/10 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30`;

const formSecondaryButtonClass = `${buttonBase} w-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-violet-400/60 hover:bg-violet-500/20`;

// ========================================
// Badge/Tag Buttons - Pill-shaped selections
// ========================================

const tagButtonClass = `${buttonBase} border border-white/10 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/20`;

const tagActiveButtonClass = `${buttonBase} border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-xs text-white`;

// ========================================
// Input Classes - Form input styling
// ========================================

const inputClass =
  "w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40";

const inputSmallClass =
  "w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40";

const textareaClass =
  "w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 resize-none";

const selectClass =
  "w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40";

// ========================================
// Exports
// ========================================

export {
  // Primary
  primaryButtonClass,
  primaryGradientButtonClass,
  primaryLargeButtonClass,
  // Secondary
  secondaryButtonClass,
  secondaryLargeButtonClass,
  // Auth
  authButtonClass,
  authPrimaryButtonClass,
  // Small
  smallButtonClass,
  smallPrimaryButtonClass,
  // Danger
  dangerButtonClass,
  dangerSmallButtonClass,
  // Success
  successButtonClass,
  // Icon
  iconButtonClass,
  iconButtonSmallClass,
  // Form
  formSubmitButtonClass,
  formSecondaryButtonClass,
  // Tags
  tagButtonClass,
  tagActiveButtonClass,
  // Inputs
  inputClass,
  inputSmallClass,
  textareaClass,
  selectClass,
};

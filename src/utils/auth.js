const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => value.trim();

const isEmailValid = (value) => {
  if (!value) {
    return false;
  }
  if (value.length > MAX_EMAIL_LENGTH || value.includes(" ")) {
    return false;
  }
  if (value.includes("..")) {
    return false;
  }
  const parts = value.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [local, domain] = parts;
  if (!local || !domain) {
    return false;
  }
  if (local.length > 64 || domain.length > 255) {
    return false;
  }
  if (domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
};

const toFriendlyAuthError = (error) => {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (code.includes("invalid-email")) {
    return "Enter a valid email address.";
  }
  if (code.includes("wrong-password")) {
    return "Incorrect password. Try again.";
  }
  if (code.includes("user-not-found")) {
    return "No account found for that email.";
  }
  if (code.includes("weak-password")) {
    return "Password must be at least 8 characters.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return error?.message || "Auth failed. Try again.";
};

export {
  isEmailValid,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  toFriendlyAuthError,
};

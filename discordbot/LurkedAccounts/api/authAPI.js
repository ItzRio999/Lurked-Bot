const express = require("express");
const admin = require("firebase-admin");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const RECAPTCHA_VERIFY_URL =
  "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MIN_SCORE = 0.5;
const ALLOWED_ACTIONS = new Set([
  "auth_signin",
  "auth_signup",
  "auth_password_reset",
]);

const parseMinScore = (value) => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MIN_SCORE;
  }
  return Math.min(Math.max(parsed, 0), 1);
};

// Shared helper used by both the verify endpoint and the signup endpoint.
// Returns { success: true, score } or throws with a user-facing message.
async function checkRecaptcha(token, action, ip) {
  const secret = process.env.RECAPTCHA_V3_SECRET_KEY;
  const minScore = parseMinScore(process.env.RECAPTCHA_V3_MIN_SCORE);
  const allowedHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (!secret) {
    throw Object.assign(new Error("reCAPTCHA verification is not configured on the server."), { status: 500 });
  }

  const body = new URLSearchParams({ secret, response: token, remoteip: ip || "" });
  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw Object.assign(new Error("Could not verify reCAPTCHA. Please try again."), { status: 500 });
  }

  const verification = await response.json();
  const hostname = String(verification.hostname || "").toLowerCase();
  const actionMatches = verification.action === action;
  const score = Number(verification.score || 0);
  const hostnameAllowed = allowedHostnames.length === 0 || allowedHostnames.includes(hostname);

  if (!verification.success || !actionMatches || !hostnameAllowed || score < minScore) {
    throw Object.assign(new Error("Security check failed. Please try again."), { status: 403 });
  }

  return { success: true, score };
}

router.post("/auth/recaptcha/verify", authLimiter, async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";

  if (!token || !action) {
    return res.status(400).json({ success: false, error: "Missing reCAPTCHA token or action." });
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, error: "Unsupported reCAPTCHA action." });
  }

  try {
    const result = await checkRecaptcha(token, action, req.ip);
    return res.json(result);
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// Signup endpoint — reCAPTCHA verification and account creation are atomic.
// Attackers cannot decouple the CAPTCHA check from user creation by bypassing the frontend.
router.post("/auth/signup", authLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const captchaToken = typeof req.body?.captchaToken === "string" ? req.body.captchaToken.trim() : "";

  if (!email || !password || !captchaToken) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    await checkRecaptcha(captchaToken, "auth_signup", req.ip);
  } catch (error) {
    return res.status(error.status || 403).json({ error: error.message });
  }

  try {
    const userRecord = await admin.auth().createUser({ email, password });
    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    return res.json({ customToken });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ error: "Invalid email address." });
    }
    if (error.code === "auth/weak-password") {
      return res.status(400).json({ error: "Password is too weak." });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Account creation failed. Please try again." });
  }
});

module.exports = router;

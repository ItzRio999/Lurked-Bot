const express = require("express");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const RECAPTCHA_VERIFY_URL =
  "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MIN_SCORE = 0.5;
const ALLOWED_ACTIONS = new Set(["auth_signin", "auth_signup"]);

const parseMinScore = (value) => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MIN_SCORE;
  }
  return Math.min(Math.max(parsed, 0), 1);
};

router.post("/auth/recaptcha/verify", authLimiter, async (req, res) => {
  const secret = process.env.RECAPTCHA_V3_SECRET_KEY;
  const minScore = parseMinScore(process.env.RECAPTCHA_V3_MIN_SCORE);
  const allowedHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (!secret) {
    return res.status(500).json({
      success: false,
      error: "reCAPTCHA verification is not configured on the server.",
    });
  }

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const action =
    typeof req.body?.action === "string" ? req.body.action.trim() : "";

  if (!token || !action) {
    return res.status(400).json({
      success: false,
      error: "Missing reCAPTCHA token or action.",
    });
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({
      success: false,
      error: "Unsupported reCAPTCHA action.",
    });
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: req.ip || "",
    });

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Google verification failed with ${response.status}`);
    }

    const verification = await response.json();
    const hostname = String(verification.hostname || "").toLowerCase();
    const actionMatches = verification.action === action;
    const score = Number(verification.score || 0);
    const hostnameAllowed =
      allowedHostnames.length === 0 || allowedHostnames.includes(hostname);

    if (
      !verification.success ||
      !actionMatches ||
      !hostnameAllowed ||
      score < minScore
    ) {
      return res.status(403).json({
        success: false,
        error: "Security check failed. Please try again.",
        reasons: {
          success: Boolean(verification.success),
          actionMatches,
          hostnameAllowed,
          score,
          minScore,
        },
      });
    }

    return res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(500).json({
      success: false,
      error: "Could not verify reCAPTCHA. Please try again.",
    });
  }
});

module.exports = router;

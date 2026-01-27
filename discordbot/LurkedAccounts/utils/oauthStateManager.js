const crypto = require("crypto");

// In-memory state storage with TTL
// Maps state token → { firebaseUid, createdAt }
const oauthStates = new Map();

// State TTL: 5 minutes
const STATE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a secure random state token and store it with Firebase UID
 * @param {string} firebaseUid - Firebase user ID
 * @returns {string} - Secure random state token
 */
function createState(firebaseUid) {
  // Generate cryptographically secure random token (32 bytes = 64 hex chars)
  const state = crypto.randomBytes(32).toString("hex");

  // Store state with metadata
  oauthStates.set(state, {
    firebaseUid,
    createdAt: Date.now(),
  });

  return state;
}

/**
 * Validate and consume a state token
 * @param {string} state - State token to validate
 * @returns {{valid: boolean, firebaseUid: string|null}} - Validation result
 */
function validateState(state) {
  const stateData = oauthStates.get(state);

  // State doesn't exist
  if (!stateData) {
    return { valid: false, firebaseUid: null };
  }

  // Check if expired
  const age = Date.now() - stateData.createdAt;
  if (age > STATE_TTL_MS) {
    // Remove expired state
    oauthStates.delete(state);
    return { valid: false, firebaseUid: null };
  }

  // Valid state - delete it (one-time use)
  oauthStates.delete(state);

  return {
    valid: true,
    firebaseUid: stateData.firebaseUid,
  };
}

/**
 * Clean up expired state tokens
 * Called periodically to prevent memory leaks
 */
function cleanupExpired() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [state, data] of oauthStates.entries()) {
    const age = now - data.createdAt;
    if (age > STATE_TTL_MS) {
      oauthStates.delete(state);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired OAuth state token(s)`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

module.exports = {
  createState,
  validateState,
  cleanupExpired,
};

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyAuth, verifyAdmin } = require("../middleware/firebaseAuth");
const { authLimiter } = require("../middleware/rateLimiter");

const OVERRIDES_COLLECTION = "verificationOverrides";

// POST /api/admin/verification/lookup
// Look up a user by email and return their verification status
router.post("/lookup", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email.trim().toLowerCase());
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        return res.status(404).json({ success: false, error: "No user found with that email" });
      }
      throw err;
    }

    const firestore = admin.firestore();

    // Check discord profile
    const discordDoc = await firestore
      .collection("users")
      .doc(userRecord.uid)
      .collection("discord")
      .doc("profile")
      .get();

    // Check override record
    const overrideDoc = await firestore
      .collection(OVERRIDES_COLLECTION)
      .doc(userRecord.uid)
      .get();

    const override = overrideDoc.exists ? overrideDoc.data() : {};
    const discordData = discordDoc.exists ? discordDoc.data() : null;

    res.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        emailVerified: userRecord.emailVerified,
        createdAt: userRecord.metadata?.creationTime || null,
        lastSignIn: userRecord.metadata?.lastSignInTime || null,
        discordLinked: discordDoc.exists,
        discordUsername: discordData?.username || null,
        discordId: discordData?.discordId || null,
        discordAdminGranted: discordData?.adminGranted || false,
        emailAdminGranted: override.emailGranted || false,
        emailGrantedAt: override.emailGrantedAt?.toDate?.()?.toISOString() || null,
        emailGrantedBy: override.emailGrantedBy || null,
        discordGrantedAt: override.discordGrantedAt?.toDate?.()?.toISOString() || null,
        discordGrantedBy: override.discordGrantedBy || null,
      },
    });
  } catch (err) {
    console.error("Error in verification lookup:", err);
    res.status(500).json({ success: false, error: "Failed to look up user" });
  }
});

// POST /api/admin/verification/:uid/grant-email
router.post("/:uid/grant-email", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    await admin.auth().updateUser(uid, { emailVerified: true });

    await admin.firestore().collection(OVERRIDES_COLLECTION).doc(uid).set(
      {
        emailGranted: true,
        emailGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
        emailGrantedBy: req.user.email,
        uid,
      },
      { merge: true }
    );

    await admin.firestore().collection("adminLogs").add({
      action: "Verification Override",
      details: `Email verification granted for UID: ${uid}`,
      adminEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error granting email verification:", err);
    res.status(500).json({ success: false, error: "Failed to grant email verification" });
  }
});

// POST /api/admin/verification/:uid/revoke-email
router.post("/:uid/revoke-email", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    await admin.auth().updateUser(uid, { emailVerified: false });

    await admin.firestore().collection(OVERRIDES_COLLECTION).doc(uid).set(
      {
        emailGranted: false,
        emailGrantedAt: null,
        emailGrantedBy: null,
      },
      { merge: true }
    );

    await admin.firestore().collection("adminLogs").add({
      action: "Verification Override",
      details: `Email verification revoked for UID: ${uid}`,
      adminEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error revoking email verification:", err);
    res.status(500).json({ success: false, error: "Failed to revoke email verification" });
  }
});

// POST /api/admin/verification/:uid/grant-discord
// Writes a synthetic discord profile so the user passes the discord gate
router.post("/:uid/grant-discord", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const firestore = admin.firestore();

    // Fetch user's email for the profile note
    let userEmail = uid;
    try {
      const userRecord = await admin.auth().getUser(uid);
      userEmail = userRecord.email || uid;
    } catch (_) {}

    const syntheticProfile = {
      discordId: `admin_granted_${uid}`,
      username: "admin_granted",
      discriminator: "0",
      globalName: "Admin Granted",
      avatar: null,
      avatarUrl: null,
      adminGranted: true,
      adminGrantedBy: req.user.email,
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    await firestore
      .collection("users")
      .doc(uid)
      .collection("discord")
      .doc("profile")
      .set(syntheticProfile);

    await firestore.collection(OVERRIDES_COLLECTION).doc(uid).set(
      {
        discordGranted: true,
        discordGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
        discordGrantedBy: req.user.email,
        uid,
      },
      { merge: true }
    );

    await firestore.collection("adminLogs").add({
      action: "Verification Override",
      details: `Discord verification granted for UID: ${uid} (${userEmail})`,
      adminEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error granting discord verification:", err);
    res.status(500).json({ success: false, error: "Failed to grant Discord verification" });
  }
});

// POST /api/admin/verification/:uid/revoke-discord
router.post("/:uid/revoke-discord", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const firestore = admin.firestore();

    await firestore
      .collection("users")
      .doc(uid)
      .collection("discord")
      .doc("profile")
      .delete();

    await firestore.collection(OVERRIDES_COLLECTION).doc(uid).set(
      {
        discordGranted: false,
        discordGrantedAt: null,
        discordGrantedBy: null,
      },
      { merge: true }
    );

    await firestore.collection("adminLogs").add({
      action: "Verification Override",
      details: `Discord verification revoked for UID: ${uid}`,
      adminEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error revoking discord verification:", err);
    res.status(500).json({ success: false, error: "Failed to revoke Discord verification" });
  }
});

// GET /api/admin/verification/overrides
// Returns all users who have any active admin-granted verification
router.get("/overrides", authLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const firestore = admin.firestore();
    const snap = await firestore.collection(OVERRIDES_COLLECTION).get();

    const overrides = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.emailGranted && !data.discordGranted) continue;

      // Fetch email from Auth
      let email = null;
      try {
        const userRecord = await admin.auth().getUser(doc.id);
        email = userRecord.email;
      } catch (_) {}

      overrides.push({
        uid: doc.id,
        email,
        emailGranted: data.emailGranted || false,
        emailGrantedAt: data.emailGrantedAt?.toDate?.()?.toISOString() || null,
        emailGrantedBy: data.emailGrantedBy || null,
        discordGranted: data.discordGranted || false,
        discordGrantedAt: data.discordGrantedAt?.toDate?.()?.toISOString() || null,
        discordGrantedBy: data.discordGrantedBy || null,
      });
    }

    res.json({ success: true, overrides });
  } catch (err) {
    console.error("Error fetching overrides:", err);
    res.status(500).json({ success: false, error: "Failed to fetch verification overrides" });
  }
});

module.exports = router;

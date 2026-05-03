const express = require("express");
const admin = require("firebase-admin");
const { verifyAuth, verifyAdmin } = require("../middleware/firebaseAuth");
const { verifyAppCheck } = require("../middleware/appCheck");

const router = express.Router();

function getDb() {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }
  return admin.firestore();
}

function getAuthorName(req) {
  const displayName = String(req.user?.displayName || "").trim();
  if (displayName) return displayName;

  const email = String(req.user?.email || "");
  const localPart = email.split("@")[0]?.trim();
  if (localPart) return localPart;

  return "Member";
}

async function writeAdminLog(action, details, adminEmail) {
  const db = getDb();
  await db.collection("adminLogs").add({
    action,
    details,
    adminEmail,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

router.post("/forums/threads", verifyAppCheck(), verifyAuth, async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const category = String(req.body?.category || "General").trim() || "General";
    const orderIndex = Number(req.body?.orderIndex);

    if (title.length < 3 || title.length > 120) {
      return res.status(400).json({ success: false, error: "Title must be between 3 and 120 characters." });
    }

    if (body.length > 800) {
      return res.status(400).json({ success: false, error: "Body must be 800 characters or less." });
    }

    const db = getDb();
    const docRef = await db.collection("threads").add({
      title,
      body,
      category,
      replyCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      authorId: req.user.uid,
      authorName: getAuthorName(req),
      orderIndex: Number.isFinite(orderIndex) ? orderIndex : Date.now(),
      pinned: false,
    });

    return res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Error creating thread:", error);
    return res.status(500).json({ success: false, error: "Unable to post thread right now." });
  }
});

router.post("/forums/threads/:threadId/replies", verifyAppCheck(), verifyAuth, async (req, res) => {
  try {
    const threadId = String(req.params.threadId || "").trim();
    const body = String(req.body?.body || "").trim();
    const replyToId = req.body?.replyToId ? String(req.body.replyToId).trim() : null;
    const replyToAuthor = req.body?.replyToAuthor ? String(req.body.replyToAuthor).trim() : null;

    if (!threadId) {
      return res.status(400).json({ success: false, error: "Missing thread id." });
    }

    if (!body || body.length > 600) {
      return res.status(400).json({ success: false, error: "Reply must be between 1 and 600 characters." });
    }

    const db = getDb();
    const threadRef = db.collection("threads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return res.status(404).json({ success: false, error: "Thread not found." });
    }

    const replyData = {
      body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      authorId: req.user.uid,
      authorName: getAuthorName(req),
    };

    if (replyToId && replyToAuthor) {
      replyData.replyToId = replyToId;
      replyData.replyToAuthor = replyToAuthor;
    }

    const batch = db.batch();
    const replyRef = threadRef.collection("replies").doc();
    batch.set(replyRef, replyData);
    batch.update(threadRef, {
      replyCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return res.json({ success: true, id: replyRef.id });
  } catch (error) {
    console.error("Error creating reply:", error);
    return res.status(500).json({ success: false, error: "Unable to post reply right now." });
  }
});

router.patch("/forums/threads/:threadId/pin", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const threadId = String(req.params.threadId || "").trim();
    const pinned = Boolean(req.body?.pinned);

    const db = getDb();
    const threadRef = db.collection("threads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return res.status(404).json({ success: false, error: "Thread not found." });
    }

    await threadRef.update({
      pinned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const thread = threadSnap.data() || {};
    await writeAdminLog(pinned ? "Pinned thread" : "Unpinned thread", thread.title || threadId, req.user.email);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error toggling thread pin:", error);
    return res.status(500).json({ success: false, error: "Unable to update thread right now." });
  }
});

router.delete("/forums/threads/:threadId", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const threadId = String(req.params.threadId || "").trim();
    const db = getDb();
    const threadRef = db.collection("threads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return res.status(404).json({ success: false, error: "Thread not found." });
    }

    const repliesSnap = await threadRef.collection("replies").get();
    let batch = db.batch();
    let opCount = 0;

    for (const replyDoc of repliesSnap.docs) {
      batch.delete(replyDoc.ref);
      opCount += 1;
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    batch.delete(threadRef);
    await batch.commit();

    const thread = threadSnap.data() || {};
    await writeAdminLog("Deleted thread", thread.title || threadId, req.user.email);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting thread:", error);
    return res.status(500).json({ success: false, error: "Unable to delete thread right now." });
  }
});

router.delete("/forums/threads/:threadId/replies/:replyId", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const threadId = String(req.params.threadId || "").trim();
    const replyId = String(req.params.replyId || "").trim();
    const db = getDb();
    const threadRef = db.collection("threads").doc(threadId);
    const replyRef = threadRef.collection("replies").doc(replyId);
    const replySnap = await replyRef.get();

    if (!replySnap.exists) {
      return res.status(404).json({ success: false, error: "Reply not found." });
    }

    const batch = db.batch();
    batch.delete(replyRef);
    batch.update(threadRef, {
      replyCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await writeAdminLog("Deleted reply", `Reply ID: ${replyId}`, req.user.email);
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return res.status(500).json({ success: false, error: "Unable to delete reply right now." });
  }
});

router.post("/forums/threads/reorder", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const threads = Array.isArray(req.body?.threads) ? req.body.threads : [];
    if (threads.length === 0) {
      return res.status(400).json({ success: false, error: "No threads provided." });
    }

    const db = getDb();
    const batch = db.batch();

    for (const thread of threads) {
      const id = String(thread?.id || "").trim();
      const orderIndex = Number(thread?.orderIndex);

      if (!id || !Number.isFinite(orderIndex)) {
        return res.status(400).json({ success: false, error: "Invalid reorder payload." });
      }

      batch.update(db.collection("threads").doc(id), {
        orderIndex,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    const movedThread = threads[0];
    await writeAdminLog("Reordered thread", movedThread?.title || "Thread order updated", req.user.email);
    return res.json({ success: true });
  } catch (error) {
    console.error("Error reordering threads:", error);
    return res.status(500).json({ success: false, error: "Unable to reorder threads right now." });
  }
});

router.post("/admin/logs", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const action = String(req.body?.action || "").trim();
    const details = String(req.body?.details || "").trim();

    if (!action) {
      return res.status(400).json({ success: false, error: "Missing action." });
    }

    await writeAdminLog(action, details, req.user.email);
    return res.json({ success: true });
  } catch (error) {
    console.error("Error writing admin log:", error);
    return res.status(500).json({ success: false, error: "Failed to write admin log." });
  }
});

router.post("/admin/admins", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email." });
    }

    const db = getDb();
    await db.collection("settings").doc("admins").update({
      emails: admin.firestore.FieldValue.arrayUnion(email),
    });
    await writeAdminLog("Added admin", email, req.user.email);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error adding admin:", error);
    return res.status(500).json({ success: false, error: "Failed to add admin." });
  }
});

router.delete("/admin/admins/:email", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const email = String(req.params.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email." });
    }

    const db = getDb();
    const adminRef = db.collection("settings").doc("admins");
    const adminSnap = await adminRef.get();
    const emails = Array.isArray(adminSnap.data()?.emails) ? adminSnap.data().emails : [];

    if (emails.length <= 1) {
      return res.status(400).json({ success: false, error: "Cannot remove the last admin." });
    }

    await adminRef.update({
      emails: admin.firestore.FieldValue.arrayRemove(email),
    });
    await writeAdminLog("Removed admin", email, req.user.email);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error removing admin:", error);
    return res.status(500).json({ success: false, error: "Failed to remove admin." });
  }
});

router.delete("/admin/logs", verifyAppCheck(), verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const logsSnap = await db.collection("adminLogs").get();
    let batch = db.batch();
    let opCount = 0;

    for (const logDoc of logsSnap.docs) {
      batch.delete(logDoc.ref);
      opCount += 1;
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error clearing admin logs:", error);
    return res.status(500).json({ success: false, error: "Failed to clear admin logs." });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { saveJson, DATA_PATH, CONFIG_PATH } = require('../utils/fileManager');
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');
const { ensureVouchState } = require("../utils/vouchStore");

// firebase-admin is initialized by firebaseAuth.js when it is first required.
// require('firebase-admin') returns the same singleton instance.
function getFirestore() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
  return admin.firestore();
}

const BACKUP_COLLECTION = 'vouches_backup';
const BACKUP_DOC = 'latest';

function getLiveData(req) {
  const liveData = req.app.locals.data;
  return ensureVouchState(liveData);
}

/**
 * GET /api/vouches/public
 * Returns sanitised vouches for the public Feedback page. No auth required.
 */
router.get('/vouches/public', async (req, res) => {
  try {
    const client = req.app.locals.client;
    const data = getLiveData(req);
    const vouches = Array.isArray(data.vouches) ? data.vouches : [];

    const enriched = await Promise.all(
      vouches.map(async (v) => {
        let userInfo = { username: v.user_tag || 'Unknown', displayName: null, avatar: null };
        try {
          const user = await client.users.fetch(v.user_id);
          userInfo = {
            username: user.username,
            displayName: user.globalName || user.username,
            avatar: user.displayAvatarURL({ size: 64, extension: 'png' }),
          };
        } catch {
          // user unavailable, use stored tag
        }
        return {
          id: v.id,
          user: userInfo,
          message: v.message,
          stars: v.stars,
          proof_url: v.proof_url || null,
          proof_type: v.proof_type || null,
          timestamp: v.timestamp,
        };
      })
    );

    res.json({ success: true, vouches: enriched.reverse(), total: enriched.length });
  } catch (error) {
    console.error('❌ Error fetching public vouches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vouches' });
  }
});

/**
 * GET /api/vouches/backup/status
 * Returns metadata of the latest Firebase backup. Admin only.
 */
router.get('/vouches/backup/status', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const doc = await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).get();
    if (!doc.exists) {
      return res.json({ success: true, backed_up_at: null, total: 0 });
    }
    const { backed_up_at, total } = doc.data();
    res.json({ success: true, backed_up_at, total });
  } catch (error) {
    console.error('❌ Error fetching backup status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch backup status' });
  }
});

/**
 * POST /api/vouches/backup
 * Backs up all vouches to Firebase Firestore. Admin only.
 */
router.post('/vouches/backup', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const data = getLiveData(req);
    const vouches = Array.isArray(data.vouches) ? data.vouches : [];
    const counter = data.vouch_counter || 0;
    const backed_up_at = new Date().toISOString();

    await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).set({
      vouches,
      vouch_counter: counter,
      backed_up_at,
      total: vouches.length,
    });

    res.json({ success: true, message: `Backed up ${vouches.length} vouches`, backed_up_at, total: vouches.length });
  } catch (error) {
    console.error('❌ Error backing up vouches:', error);
    res.status(500).json({ success: false, error: 'Backup failed: ' + error.message });
  }
});

/**
 * POST /api/vouches/restore
 * Restores vouches from the latest Firebase backup. Admin only.
 */
router.post('/vouches/restore', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).get();

    if (!snapshot.exists) {
      return res.status(404).json({ success: false, error: 'No backup found in Firebase' });
    }

    const backup = snapshot.data();
    const data = getLiveData(req);
    data.vouches = backup.vouches || [];
    data.vouch_counter = backup.vouch_counter ?? data.vouches.length;
    ensureVouchState(data);
    saveJson(DATA_PATH, data);

    res.json({
      success: true,
      message: `Restored ${data.vouches.length} vouches`,
      total: data.vouches.length,
      backed_up_at: backup.backed_up_at,
    });
  } catch (error) {
    console.error('❌ Error restoring vouches:', error);
    res.status(500).json({ success: false, error: 'Restore failed: ' + error.message });
  }
});

/**
 * GET /api/vouches
 * Returns all vouches with resolved user info. Admin only.
 */
router.get('/vouches', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;
    const data = getLiveData(req);
    const vouches = Array.isArray(data.vouches) ? data.vouches : [];

    // Resolve user info for each vouch
    const enriched = await Promise.all(
      vouches.map(async (v) => {
        let userInfo = { id: v.user_id, username: v.user_tag || 'Unknown', avatar: null };
        try {
          const user = await client.users.fetch(v.user_id);
          userInfo = {
            id: v.user_id,
            username: user.username,
            displayName: user.globalName || user.username,
            avatar: user.displayAvatarURL({ size: 64, extension: 'png' }),
          };
        } catch {
          // user left or unavailable
        }

        return {
          id: v.id,
          user: userInfo,
          message: v.message,
          stars: v.stars,
          proof_url: v.proof_url || null,
          proof_type: v.proof_type || null,
          timestamp: v.timestamp,
          guild_id: v.guild_id,
        };
      })
    );

    res.json({
      success: true,
      vouches: enriched.reverse(), // newest first
      total: enriched.length,
      vouch_channel_id: config.vouch?.channel_id || null,
      cmd_channel_id: config.vouch?.cmd_channel_id || null,
      enabled: config.vouch?.enabled || false,
    });
  } catch (error) {
    console.error('❌ Error fetching vouches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vouches' });
  }
});

/**
 * DELETE /api/vouches/:vouchId
 * Removes a vouch by ID. Admin only.
 */
router.delete('/vouches/:vouchId', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const vouchId = parseInt(req.params.vouchId, 10);
    const liveData = ensureVouchState(req.app.locals.data);
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!Array.isArray(liveData.vouches)) {
      return res.status(404).json({ success: false, error: 'No vouches found' });
    }

    const index = liveData.vouches.findIndex((v) => v.id === vouchId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Vouch not found' });
    }

    const [removedVouch] = liveData.vouches.splice(index, 1);
    if (removedVouch?.channel_message_id && config?.vouch?.channel_id) {
      try {
        const vouchChannel = await client.channels.fetch(config.vouch.channel_id);
        if (vouchChannel?.isTextBased?.()) {
          const previousMessage = await vouchChannel.messages.fetch(removedVouch.channel_message_id);
          await previousMessage.delete();
        }
      } catch (error) {
        console.warn('Failed to delete vouch channel message:', error.message);
      }
    }

    // Remove from in-memory data (prevents bot overwrites) and persist to disk
    saveJson(DATA_PATH, liveData);

    res.json({ success: true, message: `Vouch #${vouchId} deleted` });
  } catch (error) {
    console.error('❌ Error deleting vouch:', error);
    res.status(500).json({ success: false, error: 'Failed to delete vouch' });
  }
});

/**
 * GET /api/vouches/config
 * Returns vouch config section. Admin only.
 */
router.get('/vouches/config', verifyAuth, verifyAdmin, (req, res) => {
  try {
    const config = req.app.locals.config;
    res.json({
      success: true,
      config: config.vouch || { enabled: false, channel_id: null, cmd_channel_id: null, footer: null },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch vouch config' });
  }
});

/**
 * PATCH /api/vouches/config
 * Updates vouch configuration. Admin only.
 */
router.patch('/vouches/config', verifyAuth, verifyAdmin, (req, res) => {
  try {
    const { channel_id, cmd_channel_id, footer, enabled } = req.body;
    const config = req.app.locals.config;

    if (!config.vouch) {
      config.vouch = { enabled: false, channel_id: null, cmd_channel_id: null, footer: null };
    }

    if (channel_id !== undefined) config.vouch.channel_id = channel_id || null;
    if (cmd_channel_id !== undefined) config.vouch.cmd_channel_id = cmd_channel_id || null;
    if (footer !== undefined) config.vouch.footer = footer || null;
    if (enabled !== undefined) config.vouch.enabled = Boolean(enabled);

    // Auto-enable when channel is set
    if (channel_id && config.vouch.channel_id) {
      config.vouch.enabled = true;
    }

    saveJson(CONFIG_PATH, config);
    req.app.locals.config = config;

    const io = req.app.locals.io;
    if (io) io.emit('configUpdated', { section: 'vouch', data: config.vouch });

    res.json({ success: true, config: config.vouch });
  } catch (error) {
    console.error('❌ Error updating vouch config:', error);
    res.status(500).json({ success: false, error: 'Failed to update vouch config' });
  }
});

module.exports = router;

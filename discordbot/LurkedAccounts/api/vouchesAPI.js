const express = require('express');
const router = express.Router();
const { loadJson, saveJson, DATA_PATH, CONFIG_PATH } = require('../utils/fileManager');
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');

/**
 * GET /api/vouches
 * Returns all vouches with resolved user info. Admin only.
 */
router.get('/vouches', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;
    const data = loadJson(DATA_PATH, {});
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
    const data = loadJson(DATA_PATH, {});

    if (!Array.isArray(data.vouches)) {
      return res.status(404).json({ success: false, error: 'No vouches found' });
    }

    const index = data.vouches.findIndex((v) => v.id === vouchId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Vouch not found' });
    }

    data.vouches.splice(index, 1);
    saveJson(DATA_PATH, data);

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

const express = require('express');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');
const { CONFIG_PATH, saveJson, loadJson } = require('../utils/fileManager');

// GET /api/bot/config - Get entire bot configuration (admin only)
router.get('/config', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const config = req.app.locals.config;

    if (!config) {
      return res.status(500).json({
        success: false,
        error: 'Bot configuration not loaded'
      });
    }

    res.json({
      success: true,
      config: config
    });

  } catch (error) {
    console.error('❌ Error fetching bot config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration'
    });
  }
});

// GET /api/bot/config/:section - Get specific config section (admin only)
router.get('/config/:section', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { section } = req.params;
    const config = req.app.locals.config;

    if (!config) {
      return res.status(500).json({
        success: false,
        error: 'Bot configuration not loaded'
      });
    }

    if (!(section in config)) {
      return res.status(404).json({
        success: false,
        error: `Configuration section '${section}' not found`
      });
    }

    res.json({
      success: true,
      section: section,
      data: config[section]
    });

  } catch (error) {
    console.error(`❌ Error fetching config section ${req.params.section}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration section'
    });
  }
});

// PATCH /api/bot/config/:section - Update specific config section (admin only)
router.patch('/config/:section', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { section } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data in request body'
      });
    }

    const config = req.app.locals.config;

    if (!config) {
      return res.status(500).json({
        success: false,
        error: 'Bot configuration not loaded'
      });
    }

    // For 'general' section, merge top-level config fields
    if (section === 'general') {
      Object.assign(config, data);
    } else {
      // For specific sections, replace the section
      config[section] = data;
    }

    // Atomic write to config.json
    saveJson(CONFIG_PATH, config);

    // Update in-memory config
    req.app.locals.config = config;

    console.log(`✅ Config section '${section}' updated successfully`);

    // Emit Socket.io event for real-time updates
    const io = req.app.locals.io;
    if (io) {
      io.emit('configUpdated', { section, data });
      console.log(`🔔 WebSocket: Emitted configUpdated event for section '${section}'`);
    }

    res.json({
      success: true,
      message: `Configuration section '${section}' updated successfully`
    });

  } catch (error) {
    console.error(`❌ Error updating config section ${req.params.section}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// POST /api/bot/reload-config - Reload config from disk (admin only)
router.post('/reload-config', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const config = loadJson(CONFIG_PATH, {});

    if (!config || Object.keys(config).length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load configuration from disk'
      });
    }

    // Update in-memory config
    req.app.locals.config = config;

    console.log('✅ Configuration reloaded from disk');

    // Emit Socket.io event
    const io = req.app.locals.io;
    if (io) {
      io.emit('configReloaded', { config });
      console.log('🔔 WebSocket: Emitted configReloaded event');
    }

    res.json({
      success: true,
      message: 'Configuration reloaded successfully',
      config: config
    });

  } catch (error) {
    console.error('❌ Error reloading config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload configuration'
    });
  }
});

module.exports = router;

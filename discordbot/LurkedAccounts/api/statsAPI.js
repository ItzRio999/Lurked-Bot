const express = require('express');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');

// Helper function to format bytes to MB
function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

// Helper function to process staff activity data
function processStaffActivity(staffActivity, days) {
  if (!staffActivity) return [];

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const staffData = [];

  for (const [userId, data] of Object.entries(staffActivity)) {
    let totalMessages = 0;
    const dailyActivity = [];

    // Process daily activity
    if (data.daily) {
      for (const [dateStr, count] of Object.entries(data.daily)) {
        const date = new Date(dateStr);
        if (date >= cutoffDate) {
          totalMessages += count;
          dailyActivity.push({
            date: dateStr,
            count: count
          });
        }
      }
    }

    if (totalMessages > 0) {
      staffData.push({
        userId: userId,
        username: data.username || 'Unknown',
        totalMessages: totalMessages,
        dailyActivity: dailyActivity.sort((a, b) => new Date(a.date) - new Date(b.date)),
        streak: data.streak || 0,
        longestStreak: data.longestStreak || 0
      });
    }
  }

  // Sort by total messages descending
  return staffData.sort((a, b) => b.totalMessages - a.totalMessages);
}

// Helper function to process ticket data
function processTicketData(data, days) {
  if (!data || !data.tickets) {
    return {
      open: 0,
      closed: 0,
      autoClosedCount: 0,
      totalTickets: 0
    };
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  let openCount = 0;
  let closedCount = 0;
  let autoClosedCount = 0;

  // Count open tickets
  for (const ticketData of Object.values(data.tickets)) {
    openCount++;
  }

  // Count closed tickets within date range
  if (data.closed_tickets) {
    for (const closedTicket of Object.values(data.closed_tickets)) {
      if (closedTicket.closedAt) {
        const closedDate = new Date(closedTicket.closedAt);
        if (closedDate >= cutoffDate) {
          closedCount++;
          if (closedTicket.closedReason === 'auto') {
            autoClosedCount++;
          }
        }
      } else {
        closedCount++;
      }
    }
  }

  return {
    open: openCount,
    closed: closedCount,
    autoClosedCount: autoClosedCount,
    totalTickets: openCount + closedCount
  };
}

// GET /api/bot/stats/overview - Get bot overview statistics (admin only)
router.get('/stats/overview', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;
    const data = req.app.locals.data;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    const guilds = client.guilds.cache.size;
    let totalMembers = 0;

    // Calculate total members across all guilds
    client.guilds.cache.forEach(guild => {
      totalMembers += guild.memberCount;
    });

    const memUsage = process.memoryUsage();

    const stats = {
      guilds: guilds,
      members: totalMembers,
      uptime: Math.floor(process.uptime()),
      memoryUsage: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external)
      },
      online: client.isReady(),
      ping: client.ws.ping,
      configLoaded: config ? true : false
    };

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching bot stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot statistics'
    });
  }
});

// GET /api/bot/stats/staff - Get staff activity statistics (admin only)
router.get('/stats/staff', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = req.app.locals.data;

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Bot data not loaded'
      });
    }

    const staffData = processStaffActivity(data.staff_activity, days);

    res.json({
      success: true,
      days: days,
      staffData: staffData
    });

  } catch (error) {
    console.error('❌ Error fetching staff stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff statistics'
    });
  }
});

// GET /api/bot/stats/tickets - Get ticket statistics (admin only)
router.get('/stats/tickets', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = req.app.locals.data;

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Bot data not loaded'
      });
    }

    const ticketStats = processTicketData(data, days);

    res.json({
      success: true,
      days: days,
      data: ticketStats
    });

  } catch (error) {
    console.error('❌ Error fetching ticket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticket statistics'
    });
  }
});

// GET /api/bot/stats/verification - Get verification statistics (admin only)
router.get('/stats/verification', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = req.app.locals.data;

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Bot data not loaded'
      });
    }

    // Placeholder for verification stats
    // This would need to be implemented based on actual verification logging
    const verificationStats = {
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      failureReasons: {
        accountTooNew: 0,
        altDetected: 0,
        captchaFailed: 0,
        other: 0
      }
    };

    res.json({
      success: true,
      days: days,
      data: verificationStats
    });

  } catch (error) {
    console.error('❌ Error fetching verification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification statistics'
    });
  }
});

// GET /api/bot/stats/automod - Get automod statistics (admin only)
router.get('/stats/automod', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = req.app.locals.data;

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Bot data not loaded'
      });
    }

    // Count strikes
    const totalStrikes = data.automod_strikes ? Object.keys(data.automod_strikes).length : 0;

    // Placeholder for violation counts
    // This would need to be implemented based on actual automod logging
    const automodStats = {
      totalStrikes: totalStrikes,
      violations: {
        spam: 0,
        caps: 0,
        links: 0,
        badwords: 0
      },
      actionsTaken: {
        deleted: 0,
        timeout: 0,
        kick: 0,
        ban: 0
      }
    };

    res.json({
      success: true,
      days: days,
      automodStats: automodStats
    });

  } catch (error) {
    console.error('❌ Error fetching automod stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch automod statistics'
    });
  }
});

module.exports = router;

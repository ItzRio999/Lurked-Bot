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

// Helper function to process verification data
function processVerificationData(data, days) {
  if (!data || !data.security_logs) {
    return {
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
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter security logs for verification events within date range
  const verificationLogs = data.security_logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= cutoffDate && (
      log.type === 'verify_success' ||
      log.type === 'verify_fail' ||
      log.type === 'account_too_new' ||
      log.type === 'verify_timeout'
    );
  });

  let successful = 0;
  let failed = 0;
  let accountTooNew = 0;
  let altDetected = 0;
  let captchaFailed = 0;
  let other = 0;

  verificationLogs.forEach(log => {
    if (log.type === 'verify_success') {
      successful++;
    } else if (log.type === 'verify_fail') {
      failed++;
      // Check failure reason from details
      if (log.details?.reason === 'captcha') {
        captchaFailed++;
      } else if (log.details?.reason === 'alt') {
        altDetected++;
      } else {
        other++;
      }
    } else if (log.type === 'account_too_new') {
      failed++;
      accountTooNew++;
    } else if (log.type === 'verify_timeout') {
      failed++;
      other++;
    }
  });

  const totalAttempts = successful + failed;
  const successRate = totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0;

  return {
    totalAttempts,
    successful,
    failed,
    successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal place
    failureReasons: {
      accountTooNew,
      altDetected,
      captchaFailed,
      other
    }
  };
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

    const verificationStats = processVerificationData(data, days);

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

// GET /api/bot/stats/server - Get server statistics (admin only)
router.get('/stats/server', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    // Get the main guild (first guild in config or first guild in cache)
    const guildId = config?.guild_ids?.[0];
    const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found'
      });
    }

    // Calculate member statistics
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const idleMembers = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
    const dndMembers = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
    const offlineMembers = guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.members.cache.filter(m => !m.user.bot).size;

    // Calculate channel statistics
    const { ChannelType } = require('discord.js');
    const totalChannels = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;

    // Voice statistics
    let voiceMembers = 0;
    guild.channels.cache.forEach(channel => {
      if (channel.type === ChannelType.GuildVoice) {
        voiceMembers += channel.members.size;
      }
    });

    // Server boost statistics
    const boosts = guild.premiumSubscriptionCount || 0;
    const boostLevel = guild.premiumTier;

    // Role statistics
    const totalRoles = guild.roles.cache.size - 1; // Exclude @everyone

    const serverStats = {
      guildName: guild.name,
      members: {
        total: totalMembers,
        online: onlineMembers,
        idle: idleMembers,
        dnd: dndMembers,
        offline: offlineMembers,
        bots: bots,
        humans: humans,
        inVoice: voiceMembers
      },
      channels: {
        total: totalChannels,
        text: textChannels,
        voice: voiceChannels
      },
      roles: totalRoles,
      boosts: {
        count: boosts,
        level: boostLevel
      }
    };

    res.json({
      success: true,
      data: serverStats
    });

  } catch (error) {
    console.error('❌ Error fetching server stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch server statistics'
    });
  }
});

module.exports = router;

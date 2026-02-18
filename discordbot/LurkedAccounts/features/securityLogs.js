const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");

// ============== SECURITY EVENT TYPES ==============

const SecurityEventType = {
  // Verification events
  VERIFY_START: "verify_start",
  VERIFY_SUCCESS: "verify_success",
  VERIFY_FAIL: "verify_fail",
  VERIFY_TIMEOUT: "verify_timeout",
  CAPTCHA_WRONG: "captcha_wrong",

  // Account security
  ACCOUNT_TOO_NEW: "account_too_new",
  ALT_DETECTED: "alt_detected",
  SUSPICIOUS_JOIN: "suspicious_join",
  RAPID_REJOIN: "rapid_rejoin",

  // Member events
  MEMBER_JOIN: "member_join",
  MEMBER_LEAVE: "member_leave",
  MEMBER_KICKED: "member_kicked",
  MEMBER_BANNED: "member_banned",
  MEMBER_BACKUP: "member_backup",
  MEMBER_RESTORE: "member_restore",

  // Mass actions
  MASS_PULL_START: "mass_pull_start",
  MASS_PULL_COMPLETE: "mass_pull_complete",
  MASS_KICK: "mass_kick",
  MASS_BAN: "mass_ban",

  // Admin actions
  MANUAL_VERIFY: "manual_verify",
  MANUAL_UNVERIFY: "manual_unverify",
  BACKUP_CLEARED: "backup_cleared",
  CONFIG_CHANGED: "config_changed",
};

// Severity levels for events
const Severity = {
  INFO: "info",
  WARNING: "warning",
  ALERT: "alert",
  CRITICAL: "critical",
};

// ============== SECURITY LOG FUNCTIONS ==============

function logSecurityEvent(data, dataPath, event) {
  if (!data.security_logs) {
    data.security_logs = [];
  }

  const logEntry = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type: event.type,
    severity: event.severity || Severity.INFO,
    guild_id: event.guild_id,
    user_id: event.user_id || null,
    user_tag: event.user_tag || null,
    target_id: event.target_id || null,
    target_tag: event.target_tag || null,
    actor_id: event.actor_id || null,
    actor_tag: event.actor_tag || null,
    details: event.details || {},
    metadata: event.metadata || {},
  };

  data.security_logs.push(logEntry);

  // Keep only last 10000 logs to prevent file bloat
  if (data.security_logs.length > 10000) {
    data.security_logs = data.security_logs.slice(-10000);
  }

  saveJson(dataPath, data);
  return logEntry;
}

// ============== SPECIFIC EVENT LOGGERS ==============

function logVerificationAttempt(member, status, reason, data, dataPath, extra = {}) {
  const severity =
    status === "success"
      ? Severity.INFO
      : status === "timeout"
        ? Severity.WARNING
        : Severity.ALERT;

  return logSecurityEvent(data, dataPath, {
    type:
      status === "success"
        ? SecurityEventType.VERIFY_SUCCESS
        : status === "timeout"
          ? SecurityEventType.VERIFY_TIMEOUT
          : SecurityEventType.VERIFY_FAIL,
    severity,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      reason,
      account_age_days: Math.floor(
        (Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000)
      ),
      ...extra,
    },
  });
}

function logMemberJoinSecurity(member, data, dataPath) {
  const accountAgeDays = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000)
  );

  // Check for rapid rejoin
  const recentLeaves = (data.security_logs || []).filter(
    (log) =>
      log.type === SecurityEventType.MEMBER_LEAVE &&
      log.user_id === member.id &&
      new Date(log.timestamp).getTime() > Date.now() - 60 * 60 * 1000 // Last hour
  );

  const isRapidRejoin = recentLeaves.length > 0;
  const isSuspicious = accountAgeDays < 3 || isRapidRejoin;

  const event = {
    type: isRapidRejoin
      ? SecurityEventType.RAPID_REJOIN
      : isSuspicious
        ? SecurityEventType.SUSPICIOUS_JOIN
        : SecurityEventType.MEMBER_JOIN,
    severity: isRapidRejoin
      ? Severity.WARNING
      : isSuspicious
        ? Severity.WARNING
        : Severity.INFO,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      account_age_days: accountAgeDays,
      account_created: member.user.createdAt.toISOString(),
      is_bot: member.user.bot,
      has_avatar: !!member.user.avatar,
      rapid_rejoin: isRapidRejoin,
      rejoins_last_hour: recentLeaves.length,
    },
  };

  return logSecurityEvent(data, dataPath, event);
}

function logMemberLeaveSecurity(member, data, dataPath, reason = "left") {
  const membershipDuration = member.joinedAt
    ? Math.floor((Date.now() - member.joinedTimestamp) / (24 * 60 * 60 * 1000))
    : null;

  return logSecurityEvent(data, dataPath, {
    type:
      reason === "kicked"
        ? SecurityEventType.MEMBER_KICKED
        : reason === "banned"
          ? SecurityEventType.MEMBER_BANNED
          : SecurityEventType.MEMBER_LEAVE,
    severity: reason === "banned" ? Severity.ALERT : Severity.INFO,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      reason,
      membership_days: membershipDuration,
      roles_count: member.roles.cache.size - 1,
      had_nickname: !!member.nickname,
    },
  });
}

function logMemberBackup(member, backup, data, dataPath) {
  return logSecurityEvent(data, dataPath, {
    type: SecurityEventType.MEMBER_BACKUP,
    severity: Severity.INFO,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      roles_backed_up: backup.roles?.length || 0,
      had_nickname: !!backup.nickname,
    },
  });
}

function logMemberRestore(member, restored, actorId, actorTag, data, dataPath) {
  return logSecurityEvent(data, dataPath, {
    type: SecurityEventType.MEMBER_RESTORE,
    severity: Severity.INFO,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    actor_id: actorId,
    actor_tag: actorTag,
    details: {
      roles_restored: restored.roles?.length || 0,
      nickname_restored: restored.nickname || false,
    },
  });
}

function logAltDetection(member, reason, attempts, data, dataPath) {
  return logSecurityEvent(data, dataPath, {
    type: SecurityEventType.ALT_DETECTED,
    severity: Severity.ALERT,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      reason,
      verification_attempts_24h: attempts,
      account_age_days: Math.floor(
        (Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000)
      ),
    },
  });
}

function logAccountTooNew(member, accountAgeDays, requiredDays, data, dataPath) {
  return logSecurityEvent(data, dataPath, {
    type: SecurityEventType.ACCOUNT_TOO_NEW,
    severity: Severity.WARNING,
    guild_id: member.guild.id,
    user_id: member.id,
    user_tag: member.user.tag,
    details: {
      account_age_days: accountAgeDays,
      required_days: requiredDays,
      account_created: member.user.createdAt.toISOString(),
    },
  });
}

function logMassPull(guild, actorId, actorTag, stats, data, dataPath, isStart = true) {
  return logSecurityEvent(data, dataPath, {
    type: isStart ? SecurityEventType.MASS_PULL_START : SecurityEventType.MASS_PULL_COMPLETE,
    severity: Severity.ALERT,
    guild_id: guild.id,
    actor_id: actorId,
    actor_tag: actorTag,
    details: stats,
  });
}

function logAdminAction(guild, actorId, actorTag, targetId, targetTag, action, data, dataPath) {
  const typeMap = {
    manual_verify: SecurityEventType.MANUAL_VERIFY,
    manual_unverify: SecurityEventType.MANUAL_UNVERIFY,
    backup_cleared: SecurityEventType.BACKUP_CLEARED,
    config_changed: SecurityEventType.CONFIG_CHANGED,
  };

  return logSecurityEvent(data, dataPath, {
    type: typeMap[action] || action,
    severity: Severity.INFO,
    guild_id: guild.id,
    actor_id: actorId,
    actor_tag: actorTag,
    target_id: targetId,
    target_tag: targetTag,
    details: { action },
  });
}

// ============== SECURITY DASHBOARD ==============

async function showSecurityDashboard(interaction, data, config) {
  const logs = data.security_logs || [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Filter logs by time
  const last24h = logs.filter((l) => new Date(l.timestamp).getTime() > dayAgo);
  const lastWeek = logs.filter((l) => new Date(l.timestamp).getTime() > weekAgo);

  // Calculate stats
  const stats = {
    total_logs: logs.length,
    last_24h: last24h.length,
    last_week: lastWeek.length,

    // Verification stats
    verifications_success: last24h.filter((l) => l.type === SecurityEventType.VERIFY_SUCCESS)
      .length,
    verifications_fail: last24h.filter((l) => l.type === SecurityEventType.VERIFY_FAIL).length,

    // Security alerts
    suspicious_joins: last24h.filter((l) => l.type === SecurityEventType.SUSPICIOUS_JOIN).length,
    alt_detections: last24h.filter((l) => l.type === SecurityEventType.ALT_DETECTED).length,
    rapid_rejoins: last24h.filter((l) => l.type === SecurityEventType.RAPID_REJOIN).length,
    accounts_too_new: last24h.filter((l) => l.type === SecurityEventType.ACCOUNT_TOO_NEW).length,

    // Member flow
    joins_24h: last24h.filter(
      (l) =>
        l.type === SecurityEventType.MEMBER_JOIN || l.type === SecurityEventType.SUSPICIOUS_JOIN
    ).length,
    leaves_24h: last24h.filter((l) => l.type === SecurityEventType.MEMBER_LEAVE).length,
    kicks_24h: last24h.filter((l) => l.type === SecurityEventType.MEMBER_KICKED).length,
    bans_24h: last24h.filter((l) => l.type === SecurityEventType.MEMBER_BANNED).length,

    // Backups
    backups_24h: last24h.filter((l) => l.type === SecurityEventType.MEMBER_BACKUP).length,
    restores_24h: last24h.filter((l) => l.type === SecurityEventType.MEMBER_RESTORE).length,
  };

  // Severity breakdown
  const critical = last24h.filter((l) => l.severity === Severity.CRITICAL).length;
  const alerts = last24h.filter((l) => l.severity === Severity.ALERT).length;
  const warnings = last24h.filter((l) => l.severity === Severity.WARNING).length;

  // Security score (0-100)
  const securityScore = Math.max(
    0,
    100 -
      critical * 20 -
      alerts * 10 -
      warnings * 2 -
      stats.alt_detections * 15 -
      stats.suspicious_joins * 5
  );

  const scoreColor =
    securityScore >= 80 ? 0x57f287 : securityScore >= 50 ? 0x522081 : 0xed4245;
  const scoreEmoji = securityScore >= 80 ? "🟢" : securityScore >= 50 ? "🟡" : "🔴";

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("Security Dashboard")
      .setDescription(
        `${scoreEmoji} **Security Score: ${securityScore}/100**\n\n` +
          `Overview of security events in the last 24 hours.`
      )
      .addFields(
        {
          name: "Verification (24h)",
          value:
            `✅ Passed: ${stats.verifications_success}\n` +
            `❌ Failed: ${stats.verifications_fail}`,
          inline: true,
        },
        {
          name: "Security Alerts (24h)",
          value:
            `⚠️ Suspicious Joins: ${stats.suspicious_joins}\n` +
            `🔄 Rapid Rejoins: ${stats.rapid_rejoins}\n` +
            `👥 Alt Detections: ${stats.alt_detections}\n` +
            `🆕 Accounts Too New: ${stats.accounts_too_new}`,
          inline: true,
        },
        {
          name: "Member Flow (24h)",
          value:
            `📥 Joins: ${stats.joins_24h}\n` +
            `📤 Leaves: ${stats.leaves_24h}\n` +
            `👢 Kicks: ${stats.kicks_24h}\n` +
            `🔨 Bans: ${stats.bans_24h}`,
          inline: true,
        },
        {
          name: "Backup System (24h)",
          value: `💾 Backups: ${stats.backups_24h}\n` + `♻️ Restores: ${stats.restores_24h}`,
          inline: true,
        },
        {
          name: "Event Severity (24h)",
          value:
            `🔴 Critical: ${critical}\n` + `🟠 Alerts: ${alerts}\n` + `🟡 Warnings: ${warnings}`,
          inline: true,
        },
        {
          name: "Total Logs",
          value: `📊 All time: ${stats.total_logs}\n` + `📅 Last 7 days: ${stats.last_week}`,
          inline: true,
        }
      )
      .setColor(scoreColor)
      .setTimestamp(),
    config
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("security_logs_recent")
      .setLabel("Recent Logs")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📋"),
    new ButtonBuilder()
      .setCustomId("security_logs_alerts")
      .setLabel("View Alerts")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨")
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showRecentLogs(interaction, data, config, alertsOnly = false) {
  const logs = data.security_logs || [];

  let filtered = logs;
  if (alertsOnly) {
    filtered = logs.filter(
      (l) => l.severity === Severity.ALERT || l.severity === Severity.CRITICAL
    );
  }

  const recent = filtered.slice(-15).reverse();

  if (recent.length === 0) {
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(alertsOnly ? "No security alerts found." : "No security logs found.")
        .setColor(0x57f287),
      config
    );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const formatLog = (log) => {
    const time = `<t:${Math.floor(new Date(log.timestamp).getTime() / 1000)}:R>`;
    const user = log.user_tag ? `**${log.user_tag}**` : "Unknown";
    const severityEmoji =
      log.severity === Severity.CRITICAL
        ? "🔴"
        : log.severity === Severity.ALERT
          ? "🟠"
          : log.severity === Severity.WARNING
            ? "🟡"
            : "⚪";

    const typeLabels = {
      [SecurityEventType.VERIFY_SUCCESS]: "Verified",
      [SecurityEventType.VERIFY_FAIL]: "Verify Failed",
      [SecurityEventType.VERIFY_TIMEOUT]: "Verify Timeout",
      [SecurityEventType.ACCOUNT_TOO_NEW]: "Account Too New",
      [SecurityEventType.ALT_DETECTED]: "Alt Detected",
      [SecurityEventType.SUSPICIOUS_JOIN]: "Suspicious Join",
      [SecurityEventType.RAPID_REJOIN]: "Rapid Rejoin",
      [SecurityEventType.MEMBER_JOIN]: "Joined",
      [SecurityEventType.MEMBER_LEAVE]: "Left",
      [SecurityEventType.MEMBER_KICKED]: "Kicked",
      [SecurityEventType.MEMBER_BANNED]: "Banned",
      [SecurityEventType.MEMBER_BACKUP]: "Backed Up",
      [SecurityEventType.MEMBER_RESTORE]: "Restored",
      [SecurityEventType.MASS_PULL_START]: "Mass Pull Started",
      [SecurityEventType.MASS_PULL_COMPLETE]: "Mass Pull Complete",
      [SecurityEventType.MANUAL_VERIFY]: "Manual Verify",
      [SecurityEventType.MANUAL_UNVERIFY]: "Manual Unverify",
    };

    const label = typeLabels[log.type] || log.type;
    return `${severityEmoji} ${time} - ${user} - ${label}`;
  };

  const logText = recent.map(formatLog).join("\n");

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle(alertsOnly ? "Security Alerts" : "Recent Security Logs")
      .setDescription(logText.substring(0, 4000))
      .setColor(alertsOnly ? 0xed4245 : 0x522081)
      .setFooter({ text: `Showing ${recent.length} of ${filtered.length} logs` })
      .setTimestamp(),
    config
  );

  return interaction.update({ embeds: [embed], components: [] });
}

// ============== SECURITY LOG CHANNEL ==============

async function sendSecurityLogEmbed(guild, event, config) {
  const channelId = config.security_log_channel_id || config.verify_log_channel_id;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const severityColors = {
    [Severity.INFO]: 0x522081,
    [Severity.WARNING]: 0x522081,
    [Severity.ALERT]: 0x522081,
    [Severity.CRITICAL]: 0xed4245,
  };

  const severityEmojis = {
    [Severity.INFO]: "ℹ️",
    [Severity.WARNING]: "⚠️",
    [Severity.ALERT]: "🚨",
    [Severity.CRITICAL]: "🔴",
  };

  const typeLabels = {
    [SecurityEventType.VERIFY_SUCCESS]: "Verification Passed",
    [SecurityEventType.VERIFY_FAIL]: "Verification Failed",
    [SecurityEventType.VERIFY_TIMEOUT]: "Verification Timeout",
    [SecurityEventType.ACCOUNT_TOO_NEW]: "Account Too New",
    [SecurityEventType.ALT_DETECTED]: "Alt Account Detected",
    [SecurityEventType.SUSPICIOUS_JOIN]: "Suspicious Join",
    [SecurityEventType.RAPID_REJOIN]: "Rapid Rejoin Detected",
    [SecurityEventType.MEMBER_JOIN]: "Member Joined",
    [SecurityEventType.MEMBER_LEAVE]: "Member Left",
    [SecurityEventType.MEMBER_KICKED]: "Member Kicked",
    [SecurityEventType.MEMBER_BANNED]: "Member Banned",
    [SecurityEventType.MEMBER_BACKUP]: "Member Backed Up",
    [SecurityEventType.MEMBER_RESTORE]: "Member Restored",
    [SecurityEventType.MASS_PULL_START]: "Mass Pull Started",
    [SecurityEventType.MASS_PULL_COMPLETE]: "Mass Pull Complete",
    [SecurityEventType.MANUAL_VERIFY]: "Manual Verification",
    [SecurityEventType.MANUAL_UNVERIFY]: "Manual Unverification",
    [SecurityEventType.BACKUP_CLEARED]: "Backup Cleared",
  };

  const embed = new EmbedBuilder()
    .setTitle(`${severityEmojis[event.severity]} ${typeLabels[event.type] || event.type}`)
    .setColor(severityColors[event.severity])
    .setTimestamp();

  // Add user info if present
  if (event.user_id) {
    embed.addFields({
      name: "User",
      value: `<@${event.user_id}> (${event.user_tag || event.user_id})`,
      inline: true,
    });
  }

  // Add actor info if present (for admin actions)
  if (event.actor_id) {
    embed.addFields({
      name: "Action By",
      value: `<@${event.actor_id}> (${event.actor_tag || event.actor_id})`,
      inline: true,
    });
  }

  // Add details
  if (event.details && Object.keys(event.details).length > 0) {
    const detailsText = Object.entries(event.details)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `**${k.replace(/_/g, " ")}:** ${v}`)
      .join("\n");

    if (detailsText) {
      embed.addFields({ name: "Details", value: detailsText.substring(0, 1024) });
    }
  }

  await channel.send({ embeds: [embed] }).catch(console.error);
}

// ============== EXPORTS ==============

module.exports = {
  // Event types
  SecurityEventType,
  Severity,

  // Core logging
  logSecurityEvent,

  // Specific loggers
  logVerificationAttempt,
  logMemberJoinSecurity,
  logMemberLeaveSecurity,
  logMemberBackup,
  logMemberRestore,
  logAltDetection,
  logAccountTooNew,
  logMassPull,
  logAdminAction,

  // Aliases for backward compatibility
  logMemberJoin: logMemberJoinSecurity,
  logMemberLeave: logMemberLeaveSecurity,
  logVerification: logVerificationAttempt,

  // Dashboard & views
  showSecurityDashboard,
  showRecentLogs,

  // Channel logging
  sendSecurityLogEmbed,
};

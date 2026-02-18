const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { saveJson } = require("../utils/fileManager");

// Blocked words list (severe slurs and cheating terms only)
const DEFAULT_BLOCKED_WORDS = [
  // Severe racial slurs - N-word variations
  "nigger", "nigga", "n1gger", "n1gga", "nigg3r", "nigg4", "n!gger", "n!gga",
  "nig", "niqqer", "niqqa", "nibba", "negr0", "n3gr0", "ngr",

  // Other severe slurs
  "chink", "ch1nk", "gook", "g00k", "kike", "k1ke", "coon", "c00n",

  // Cheating/hacking terms
  "spoofer", "sp00fer", "spo0fer", "sp0ofer", "hwid spoof",
  "cheat", "che4t", "ch3at", "cheats", "cheater", "che4ter",
  "hack", "h4ck", "hacks", "hacker", "h4cker", "hax", "haxxor",
  "aimbot", "a1mbot", "wallhack", "wall hack", "esp hack", "radar hack",
  "triggerbot", "bhop hack", "no recoil", "norecoil",
  "inject", "1nject", "injector", "dll inject", "external cheat",
  "undetected", "ud cheat", "private cheat", "sellix", "cracked"
];

// Default automod configuration (delete only - no strikes/bans)
const DEFAULT_AUTOMOD_CONFIG = {
  enabled: true,
  spam: {
    enabled: true,
    message_limit: 5, // messages
    time_window: 10000, // ms (10 seconds)
    ignore_roles: []
  },
  caps: {
    enabled: false, // Disabled by default
    percentage: 70, // % of message that is caps
    min_length: 10, // minimum message length to check
    ignore_roles: []
  },
  links: {
    enabled: true,
    block_invites: true,
    whitelist: [], // allowed domains
    ignore_roles: []
  },
  badwords: {
    enabled: true,
    words: DEFAULT_BLOCKED_WORDS,
    ignore_roles: []
  },
  log_channel_id: null,
  immune_roles: [] // roles immune to all automod
};

// Message tracking for spam detection
const messageCache = new Map(); // userId -> [timestamps]

// Get automod config or create default
function getAutomodConfig(config) {
  if (!config.automod) {
    config.automod = DEFAULT_AUTOMOD_CONFIG;
  }
  return config.automod;
}

// Check if user has immune role
function hasImmuneRole(member, automodConfig) {
  if (!member || !member.roles) return false;
  return automodConfig.immune_roles.some(roleId => member.roles.cache.has(roleId));
}

// Check spam
function checkSpam(message, automodConfig) {
  if (!automodConfig.spam.enabled) return null;

  const userId = message.author.id;
  const now = Date.now();

  // Get user's recent messages
  if (!messageCache.has(userId)) {
    messageCache.set(userId, []);
  }

  const timestamps = messageCache.get(userId);

  // Remove old timestamps
  const validTimestamps = timestamps.filter(t => now - t < automodConfig.spam.time_window);
  validTimestamps.push(now);
  messageCache.set(userId, validTimestamps);

  // Clean up cache periodically
  if (messageCache.size > 1000) {
    const entries = Array.from(messageCache.entries());
    for (const [uid, times] of entries) {
      if (times.length === 0 || now - times[times.length - 1] > 60000) {
        messageCache.delete(uid);
      }
    }
  }

  // Check if spam threshold exceeded
  if (validTimestamps.length >= automodConfig.spam.message_limit) {
    return {
      type: "spam",
      reason: `Sent ${validTimestamps.length} messages in ${automodConfig.spam.time_window / 1000} seconds`
    };
  }

  return null;
}

// Check caps
function checkCaps(message, automodConfig) {
  if (!automodConfig.caps.enabled) return null;
  if (message.content.length < automodConfig.caps.min_length) return null;

  const letters = message.content.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return null;

  const upperCount = (message.content.match(/[A-Z]/g) || []).length;
  const capsPercentage = (upperCount / letters.length) * 100;

  if (capsPercentage >= automodConfig.caps.percentage) {
    return {
      type: "caps",
      reason: `${Math.round(capsPercentage)}% caps (limit: ${automodConfig.caps.percentage}%)`
    };
  }

  return null;
}

// Check links
function checkLinks(message, automodConfig) {
  if (!automodConfig.links.enabled) return null;

  const content = message.content.toLowerCase();

  // Check for Discord invites
  if (automodConfig.links.block_invites) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
    if (inviteRegex.test(content)) {
      return {
        type: "invite",
        reason: "Discord invite link detected"
      };
    }
  }

  // Check for links
  const linkRegex = /https?:\/\/[^\s]+/gi;
  const links = content.match(linkRegex);

  if (links && links.length > 0) {
    // Check whitelist
    if (automodConfig.links.whitelist.length > 0) {
      // Whitelist exists - check if link is allowed
      const allowed = links.every(link => {
        return automodConfig.links.whitelist.some(domain => link.includes(domain.toLowerCase()));
      });

      if (!allowed) {
        return {
          type: "link",
          reason: "Link not in whitelist"
        };
      }
    } else {
      // No whitelist - block all links
      return {
        type: "link",
        reason: "Links are not allowed"
      };
    }
  }

  return null;
}

// Escape regex special characters to prevent ReDoS attacks
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check bad words with enhanced detection
function checkBadWords(message, automodConfig) {
  if (!automodConfig.badwords.enabled || automodConfig.badwords.words.length === 0) return null;

  let content = message.content.toLowerCase();

  // Leet speak normalization
  const leetNormalized = content
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/!/g, 'i');

  for (const word of automodConfig.badwords.words) {
    const escapedWord = escapeRegex(word.toLowerCase());

    // Check word boundaries in original content (most accurate)
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    if (regex.test(content) || regex.test(leetNormalized)) {
      return {
        type: "badword",
        reason: `Contains prohibited content`,
        matchedWord: word
      };
    }

    // Only check for obfuscation with separators (not complete space removal)
    const obfuscatedPatterns = [
      content.replace(/[_\-.|]+/g, ''),
      content.replace(/\s*[_\-.|]+\s*/g, ''),
    ];

    for (const pattern of obfuscatedPatterns) {
      const obfuscatedRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      if (obfuscatedRegex.test(pattern)) {
        return {
          type: "badword",
          reason: `Contains prohibited content (obfuscated)`,
          matchedWord: word
        };
      }
    }
  }

  return null;
}

// Execute moderation action (delete only)
async function executeAction(message, violation, automodConfig) {
  try {
    // Delete the message
    await message.delete().catch(() => {});

    // Log to channel
    if (automodConfig.log_channel_id) {
      const logChannel = message.guild.channels.cache.get(automodConfig.log_channel_id);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle(`Auto-Moderation Action`)
          .addFields(
            { name: "User", value: `${message.author} (${message.author.tag})`, inline: true },
            { name: "Violation", value: violation.type.toUpperCase(), inline: true },
            { name: "Action", value: "DELETE", inline: true },
            { name: "Channel", value: `${message.channel}`, inline: true },
            { name: "Reason", value: violation.reason, inline: true },
            { name: "\u200b", value: "\u200b", inline: true }
          )
          .setColor(0x522081)
          .setTimestamp();

        if (message.content) {
          // Censor bad words in logs
          let censoredContent = message.content;
          if (violation.matchedWord) {
            const regex = new RegExp(escapeRegex(violation.matchedWord), 'gi');
            censoredContent = censoredContent.replace(regex, '[CENSORED]');
          }
          embed.addFields({
            name: "Message Content",
            value: censoredContent.substring(0, 1000),
            inline: false
          });
        }

        await logChannel.send({ embeds: [embed] });
      }
    }

    return true;
  } catch (error) {
    console.error("Error executing automod action:", error);
    return false;
  }
}

// Check if channel is a ticket channel
function isTicketChannel(channelId, data) {
  return data.tickets && data.tickets[channelId] && !data.tickets[channelId].closed;
}

// Process message through automod
async function processMessage(message, config, configPath, data) {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  const automodConfig = getAutomodConfig(config);
  if (!automodConfig.enabled) return;

  // Check if user is immune
  if (hasImmuneRole(message.member, automodConfig)) return;

  // Check permissions
  if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

  // Check if this is a ticket channel - exempt from caps and links
  const isTicket = data && isTicketChannel(message.channel.id, data);

  // Run all checks (skip caps and links in tickets)
  const checks = [
    checkSpam(message, automodConfig),
    isTicket ? null : checkCaps(message, automodConfig),
    isTicket ? null : checkLinks(message, automodConfig),
    checkBadWords(message, automodConfig)
  ].filter(Boolean);

  for (const violation of checks) {
    if (violation) {
      // Check specific ignore roles
      const specificConfig = automodConfig[violation.type === "invite" ? "links" : violation.type === "badword" ? "badwords" : violation.type];
      if (specificConfig?.ignore_roles?.some(roleId => message.member?.roles.cache.has(roleId))) {
        continue;
      }

      // Delete the message
      await executeAction(message, violation, automodConfig);
      break; // Only execute first violation
    }
  }
}

// Configure automod
async function configureAutomod(interaction, config, configPath) {
  const subcommand = interaction.options.getSubcommand();
  const automodConfig = getAutomodConfig(config);

  if (subcommand === "enable") {
    automodConfig.enabled = true;
    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setDescription("✅ Auto-moderation enabled!")
      .setColor(0x57F287);
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "disable") {
    automodConfig.enabled = false;
    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setDescription("❌ Auto-moderation disabled!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "spam") {
    const enabled = interaction.options.getBoolean("enabled") ?? automodConfig.spam.enabled;
    const messageLimit = interaction.options.getInteger("messages") ?? automodConfig.spam.message_limit;
    const timeWindow = interaction.options.getInteger("seconds") ?? (automodConfig.spam.time_window / 1000);

    automodConfig.spam.enabled = enabled;
    automodConfig.spam.message_limit = messageLimit;
    automodConfig.spam.time_window = timeWindow * 1000;

    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setTitle("Spam Filter Configured")
      .addFields(
        { name: "Status", value: enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Trigger", value: `${messageLimit} messages in ${timeWindow}s`, inline: true },
        { name: "Action", value: "DELETE", inline: true }
      )
      .setColor(0x57F287)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "caps") {
    const enabled = interaction.options.getBoolean("enabled") ?? automodConfig.caps.enabled;
    const percentage = interaction.options.getInteger("percentage") ?? automodConfig.caps.percentage;

    automodConfig.caps.enabled = enabled;
    automodConfig.caps.percentage = percentage;

    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setTitle("Caps Filter Configured")
      .addFields(
        { name: "Status", value: enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Threshold", value: `${percentage}% caps`, inline: true },
        { name: "Action", value: "DELETE", inline: true }
      )
      .setColor(0x57F287)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "links") {
    const enabled = interaction.options.getBoolean("enabled") ?? automodConfig.links.enabled;
    const blockInvites = interaction.options.getBoolean("block_invites") ?? automodConfig.links.block_invites;

    automodConfig.links.enabled = enabled;
    automodConfig.links.block_invites = blockInvites;

    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setTitle("Link Filter Configured")
      .addFields(
        { name: "Status", value: enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Block Invites", value: blockInvites ? "✅ Yes" : "❌ No", inline: true },
        { name: "Action", value: "DELETE", inline: true }
      )
      .setColor(0x57F287)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "badwords") {
    const word = interaction.options.getString("word");
    const remove = interaction.options.getBoolean("remove") || false;

    if (remove) {
      automodConfig.badwords.words = automodConfig.badwords.words.filter(w => w.toLowerCase() !== word.toLowerCase());
      config.automod = automodConfig;
      saveJson(configPath, config);

      const embed = new EmbedBuilder()
        .setDescription(`✅ Removed \`${word}\` from bad words list`)
        .setColor(0x57F287);
      return interaction.reply({ embeds: [embed], flags: 64 });
    } else {
      if (!automodConfig.badwords.words.includes(word.toLowerCase())) {
        automodConfig.badwords.words.push(word.toLowerCase());
        automodConfig.badwords.enabled = true;
      }

      config.automod = automodConfig;
      saveJson(configPath, config);

      const embed = new EmbedBuilder()
        .setDescription(`✅ Added \`${word}\` to bad words list\n\n**Total words:** ${automodConfig.badwords.words.length}`)
        .setColor(0x57F287);
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }

  if (subcommand === "whitelist") {
    const domain = interaction.options.getString("domain");
    const remove = interaction.options.getBoolean("remove") || false;

    if (remove) {
      automodConfig.links.whitelist = automodConfig.links.whitelist.filter(d => d.toLowerCase() !== domain.toLowerCase());
    } else {
      if (!automodConfig.links.whitelist.includes(domain.toLowerCase())) {
        automodConfig.links.whitelist.push(domain.toLowerCase());
      }
    }

    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setDescription(`✅ ${remove ? "Removed" : "Added"} \`${domain}\` ${remove ? "from" : "to"} whitelist\n\n**Whitelisted domains:** ${automodConfig.links.whitelist.length}`)
      .setColor(0x57F287);
    return interaction.reply({ embeds: [embed], flags: 64 });
  }

  if (subcommand === "logchannel") {
    const channel = interaction.options.getChannel("channel", true);

    automodConfig.log_channel_id = channel.id;
    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setDescription(`✅ Auto-mod log channel set to ${channel}`)
      .setColor(0x57F287);
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "immune") {
    const role = interaction.options.getRole("role", true);
    const remove = interaction.options.getBoolean("remove") || false;

    if (remove) {
      automodConfig.immune_roles = automodConfig.immune_roles.filter(r => r !== role.id);
    } else {
      if (!automodConfig.immune_roles.includes(role.id)) {
        automodConfig.immune_roles.push(role.id);
      }
    }

    config.automod = automodConfig;
    saveJson(configPath, config);

    const embed = new EmbedBuilder()
      .setDescription(`✅ ${remove ? "Removed" : "Added"} ${role} ${remove ? "from" : "to"} immune roles`)
      .setColor(0x57F287);
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "status") {
    const embed = new EmbedBuilder()
      .setTitle("Auto-Moderation Status")
      .setDescription(`**System:** ${automodConfig.enabled ? "✅ Enabled" : "❌ Disabled"}\n**Action:** All violations → DELETE`)
      .addFields(
        {
          name: "Spam Filter",
          value: `${automodConfig.spam.enabled ? "✅" : "❌"} ${automodConfig.spam.message_limit} msgs/${automodConfig.spam.time_window / 1000}s`,
          inline: true
        },
        {
          name: "Caps Filter",
          value: `${automodConfig.caps.enabled ? "✅" : "❌"} ${automodConfig.caps.percentage}%`,
          inline: true
        },
        {
          name: "Link Filter",
          value: `${automodConfig.links.enabled ? "✅" : "❌"} ${automodConfig.links.block_invites ? "Block invites" : "Allow invites"}`,
          inline: true
        },
        {
          name: "Bad Words",
          value: `${automodConfig.badwords.enabled ? "✅" : "❌"} ${automodConfig.badwords.words.length} words`,
          inline: true
        },
        {
          name: "Log Channel",
          value: automodConfig.log_channel_id ? `<#${automodConfig.log_channel_id}>` : "Not set",
          inline: true
        },
        {
          name: "Immune Roles",
          value: automodConfig.immune_roles.length > 0 ? automodConfig.immune_roles.map(r => `<@&${r}>`).join(", ") : "None",
          inline: true
        }
      )
      .setColor(0x522081)
      .setFooter({ text: "Use /automod <feature> to configure" })
      .setTimestamp();

    if (automodConfig.links.whitelist.length > 0) {
      embed.addFields({
        name: "Whitelisted Domains",
        value: automodConfig.links.whitelist.join(", "),
        inline: false
      });
    }

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = {
  processMessage,
  configureAutomod,
  getAutomodConfig,
  DEFAULT_AUTOMOD_CONFIG,
  DEFAULT_BLOCKED_WORDS
};

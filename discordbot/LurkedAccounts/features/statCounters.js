const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { saveJson, CONFIG_PATH } = require("../utils/fileManager");

/**
 * Stat Counter System - Display live server statistics in voice channels
 * Similar to StatBot.net functionality
 */

// Available stat types and their display formats
const STAT_TYPES = {
  total_members: {
    name: "Total Members",
    icon: "👥",
    getValue: (guild) => guild.memberCount
  },
  online_members: {
    name: "Online Members",
    icon: "🟢",
    getValue: (guild) => guild.members.cache.filter(m => m.presence?.status === 'online').size
  },
  idle_members: {
    name: "Idle Members",
    icon: "🟡",
    getValue: (guild) => guild.members.cache.filter(m => m.presence?.status === 'idle').size
  },
  dnd_members: {
    name: "DND Members",
    icon: "🔴",
    getValue: (guild) => guild.members.cache.filter(m => m.presence?.status === 'dnd').size
  },
  offline_members: {
    name: "Offline Members",
    icon: "⚫",
    getValue: (guild) => guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size
  },
  bots: {
    name: "Bots",
    icon: "🤖",
    getValue: (guild) => guild.members.cache.filter(m => m.user.bot).size
  },
  humans: {
    name: "Humans",
    icon: "👤",
    getValue: (guild) => guild.members.cache.filter(m => !m.user.bot).size
  },
  channels: {
    name: "Channels",
    icon: "📁",
    getValue: (guild) => guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size
  },
  roles: {
    name: "Roles",
    icon: "🎭",
    getValue: (guild) => guild.roles.cache.size - 1 // Exclude @everyone
  },
  boosts: {
    name: "Server Boosts",
    icon: "💎",
    getValue: (guild) => guild.premiumSubscriptionCount || 0
  },
  boost_level: {
    name: "Boost Level",
    icon: "⭐",
    getValue: (guild) => guild.premiumTier
  },
  voice_members: {
    name: "In Voice",
    icon: "🔊",
    getValue: (guild) => {
      let count = 0;
      guild.channels.cache.forEach(channel => {
        if (channel.type === ChannelType.GuildVoice) {
          count += channel.members.size;
        }
      });
      return count;
    }
  }
};

// Update interval (2 minutes to avoid rate limits)
const UPDATE_INTERVAL = 2 * 60 * 1000;

// Track update intervals per guild
const updateIntervals = new Map();

/**
 * Initialize stat counters for a guild
 */
async function initializeStatCounters(client, config) {
  if (!config.stat_counters || !config.stat_counters.enabled) {
    return;
  }

  for (const guildId of config.guild_ids || []) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    // Clear existing interval if any
    if (updateIntervals.has(guildId)) {
      clearInterval(updateIntervals.get(guildId));
    }

    // Initial update
    await updateStatCounters(guild, config);

    // Set up periodic updates
    const interval = setInterval(async () => {
      try {
        await updateStatCounters(guild, config);
      } catch (error) {
        console.error(`Error updating stat counters for ${guild.name}:`, error);
      }
    }, UPDATE_INTERVAL);

    updateIntervals.set(guildId, interval);
    console.log(`✅ Stat counters initialized for ${guild.name} (updates every ${UPDATE_INTERVAL / 60000} minutes)`);
  }
}

/**
 * Update all stat counter channels
 */
async function updateStatCounters(guild, config) {
  if (!config.stat_counters || !config.stat_counters.enabled || !config.stat_counters.counters) {
    return;
  }

  // Fetch fresh guild data to ensure memberCount is accurate
  try {
    await guild.fetch();
  } catch (error) {
    console.error(`Error fetching guild data for stat counters:`, error);
  }

  const counters = config.stat_counters.counters;

  for (const counter of counters) {
    try {
      const channel = guild.channels.cache.get(counter.channel_id);
      if (!channel) {
        console.warn(`Stat counter channel ${counter.channel_id} not found in ${guild.name}`);
        continue;
      }

      // Get the stat value
      let value;
      if (counter.type === 'custom') {
        value = counter.custom_value || 0;
      } else {
        const statType = STAT_TYPES[counter.type];
        if (!statType) {
          console.warn(`Unknown stat type: ${counter.type}`);
          continue;
        }
        value = statType.getValue(guild);
      }

      // Format the channel name
      const icon = counter.icon || (counter.type !== 'custom' ? STAT_TYPES[counter.type]?.icon : '📊') || '📊';
      const format = counter.format || '{icon} {label}: {value}';
      const label = counter.label || (counter.type !== 'custom' ? STAT_TYPES[counter.type]?.name : 'Custom');

      const newName = format
        .replace('{icon}', icon)
        .replace('{label}', label)
        .replace('{value}', value.toLocaleString());

      // Only update if name changed (to avoid rate limits)
      if (channel.name !== newName) {
        await channel.setName(newName, 'Stat counter update');
        console.log(`📊 Updated stat counter: ${newName}`);
      }
    } catch (error) {
      // Rate limit or permission error - skip silently
      if (error.code === 50013) {
        console.warn(`Missing permissions to update stat counter ${counter.channel_id}`);
      } else if (error.code === 429) {
        console.warn(`Rate limited when updating stat counter ${counter.channel_id}`);
      } else {
        console.error(`Error updating stat counter ${counter.channel_id}:`, error);
      }
    }
  }
}

/**
 * Create a new stat counter channel
 */
async function createStatCounter(guild, type, label, icon, format, customValue, config) {
  // Find or create a category for stat counters
  let category = guild.channels.cache.find(c =>
    c.type === ChannelType.GuildCategory &&
    c.name.toLowerCase().includes('stat')
  );

  if (!category) {
    category = await guild.channels.create({
      name: '📊 STAT COUNTERS',
      type: ChannelType.GuildCategory,
      position: 0,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.Connect], // Prevent users from joining
        }
      ]
    });
  }

  // Determine the stat type info
  const statType = type === 'custom' ? null : STAT_TYPES[type];
  const finalIcon = icon || statType?.icon || '📊';
  const finalLabel = label || statType?.name || 'Custom';
  const finalFormat = format || '{icon} {label}: {value}';

  // Get initial value
  let value;
  if (type === 'custom') {
    value = customValue || 0;
  } else if (statType) {
    value = statType.getValue(guild);
  } else {
    throw new Error(`Unknown stat type: ${type}`);
  }

  // Create channel name
  const channelName = finalFormat
    .replace('{icon}', finalIcon)
    .replace('{label}', finalLabel)
    .replace('{value}', value.toLocaleString());

  // Create the voice channel
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect], // Prevent users from joining
      }
    ]
  });

  // Add to config
  if (!config.stat_counters) {
    config.stat_counters = {
      enabled: true,
      counters: []
    };
  }

  if (!config.stat_counters.counters) {
    config.stat_counters.counters = [];
  }

  config.stat_counters.counters.push({
    channel_id: channel.id,
    type: type,
    label: finalLabel,
    icon: finalIcon,
    format: finalFormat,
    custom_value: type === 'custom' ? customValue : undefined
  });

  saveJson(CONFIG_PATH, config);

  return channel;
}

/**
 * Remove a stat counter
 */
async function removeStatCounter(guild, channelId, config) {
  const channel = guild.channels.cache.get(channelId);
  if (channel) {
    await channel.delete('Stat counter removed');
  }

  // Remove from config
  if (config.stat_counters && config.stat_counters.counters) {
    config.stat_counters.counters = config.stat_counters.counters.filter(
      c => c.channel_id !== channelId
    );
    saveJson(CONFIG_PATH, config);
  }
}

/**
 * Update a custom stat counter value
 */
async function updateCustomValue(guild, channelId, newValue, config) {
  // Update in config
  if (config.stat_counters && config.stat_counters.counters) {
    const counter = config.stat_counters.counters.find(c => c.channel_id === channelId);
    if (counter && counter.type === 'custom') {
      counter.custom_value = newValue;
      saveJson(CONFIG_PATH, config);

      // Immediate update
      await updateStatCounters(guild, config);
      return true;
    }
  }
  return false;
}

/**
 * Enable or disable stat counters
 */
function setEnabled(enabled, config) {
  if (!config.stat_counters) {
    config.stat_counters = {
      enabled: enabled,
      counters: []
    };
  } else {
    config.stat_counters.enabled = enabled;
  }
  saveJson(CONFIG_PATH, config);
}

/**
 * Stop all stat counter updates
 */
function stopAllUpdates() {
  for (const [guildId, interval] of updateIntervals.entries()) {
    clearInterval(interval);
    console.log(`🛑 Stopped stat counter updates for guild ${guildId}`);
  }
  updateIntervals.clear();
}

/**
 * Get available stat types
 */
function getAvailableStatTypes() {
  return Object.entries(STAT_TYPES).map(([key, value]) => ({
    id: key,
    name: value.name,
    icon: value.icon
  }));
}

module.exports = {
  initializeStatCounters,
  updateStatCounters,
  createStatCounter,
  removeStatCounter,
  updateCustomValue,
  setEnabled,
  stopAllUpdates,
  getAvailableStatTypes,
  STAT_TYPES
};

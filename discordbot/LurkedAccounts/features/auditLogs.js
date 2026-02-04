const { EmbedBuilder } = require("discord.js");
const { saveJson } = require("../utils/fileManager");
const { mention } = require("../utils/permissions");

async function logMemberJoin(member, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.member_events === false) return;

  const logChannel = member.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const accountAge = Date.now() - member.user.createdTimestamp;
  const daysOld = Math.floor(accountAge / (1000 * 60 * 60 * 24));
  const isNew = daysOld < 7;

  const embed = new EmbedBuilder()
    .setTitle("Member Joined")
    .setDescription(`${mention(member.id)} ${member.user.tag}`)
    .addFields(
      { name: "User ID", value: member.id, inline: true },
      {
        name: "Account Created",
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      { name: "Total Members", value: `${member.guild.memberCount}`, inline: true }
    )
    .setColor(isNew ? 0xFEE75C : 0x57F287)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  if (isNew) {
    embed.setFooter({ text: "Account is less than 7 days old" });
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

async function logMemberLeave(member, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.member_events === false) return;

  const logChannel = member.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const roles = member.roles.cache
    .filter((r) => r.id !== member.guild.id)
    .map((r) => r.name)
    .join(", ") || "None";

  const joinedTimestamp = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

  const embed = new EmbedBuilder()
    .setTitle("Member Left")
    .setDescription(`${member.user.tag}`)
    .addFields(
      { name: "User ID", value: member.id, inline: true },
      { name: "Total Members", value: `${member.guild.memberCount}`, inline: true }
    )
    .setColor(0xED4245)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  if (joinedTimestamp) {
    embed.addFields({ name: "Joined", value: `<t:${joinedTimestamp}:R>`, inline: true });
  }

  if (roles !== "None") {
    embed.addFields({ name: "Roles", value: roles.slice(0, 1024) });
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

async function logRoleUpdate(before, after, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.role_updates === false) return;

  const addedRoles = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
  const removedRoles = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));

  if (addedRoles.size === 0 && removedRoles.size === 0) return;

  const logChannel = after.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("Member Roles Updated")
    .setDescription(`${mention(after.id)} ${after.user.tag}`)
    .setColor(0x5865F2)
    .setThumbnail(after.user.displayAvatarURL())
    .setTimestamp();

  if (addedRoles.size > 0) {
    embed.addFields({
      name: "Added Roles",
      value: addedRoles.map((r) => r.name).join(", "),
    });
  }

  if (removedRoles.size > 0) {
    embed.addFields({
      name: "Removed Roles",
      value: removedRoles.map((r) => r.name).join(", "),
    });
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

async function logMessageDelete(message, config, data) {
  if (!message.guild || message.author?.bot) return;
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.message_delete === false) return;

  const logChannel = message.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const messageData = data.message_cache?.[message.id];
  const content = message.content || messageData?.content || "*[Content not cached]*";

  const embed = new EmbedBuilder()
    .setTitle("Message Deleted")
    .setDescription(`**Channel:** ${message.channel}\n**Author:** ${message.author || "Unknown"}`)
    .addFields({
      name: "Content",
      value: content.slice(0, 1024) || "*[No content]*",
    })
    .setColor(0xED4245)
    .setTimestamp();

  if (message.author) {
    embed.setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    });
  }

  if (message.attachments.size > 0) {
    const attachments = message.attachments.map((a) => a.name).join(", ");
    embed.addFields({ name: "Attachments", value: attachments });
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

async function logMessageEdit(before, after, config) {
  if (!after.guild || after.author?.bot) return;
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.message_edit === false) return;
  if (before.content === after.content) return;

  const logChannel = after.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("Message Edited")
    .setDescription(`**Channel:** ${after.channel}\n**Author:** ${after.author}\n[Jump to Message](${after.url})`)
    .addFields(
      {
        name: "Before",
        value: (before.content || "*[No content]*").slice(0, 1024),
      },
      {
        name: "After",
        value: (after.content || "*[No content]*").slice(0, 1024),
      }
    )
    .setColor(0xFEE75C)
    .setTimestamp();

  if (after.author) {
    embed.setAuthor({
      name: after.author.tag,
      iconURL: after.author.displayAvatarURL(),
    });
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

function cacheMessage(message, data, dataPath) {
  if (!data.message_cache) data.message_cache = {};

  data.message_cache[message.id] = {
    content: message.content,
    author_id: message.author.id,
    channel_id: message.channel.id,
    timestamp: message.createdTimestamp,
  };

  // Keep cache size reasonable (last 1000 messages)
  const cacheEntries = Object.entries(data.message_cache);
  if (cacheEntries.length > 1000) {
    cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    data.message_cache = Object.fromEntries(cacheEntries.slice(-1000));
  }

  saveJson(dataPath, data);
}

// Log timeout action
async function logTimeout(guild, targetUser, moderator, duration, reason, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const durationText = formatDuration(duration);

  const embed = new EmbedBuilder()
    .setTitle("🔇 Member Timed Out")
    .setDescription(`**Member:** ${targetUser} (${targetUser.tag})\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "User ID", value: targetUser.id, inline: true },
      { name: "Duration", value: durationText, inline: true },
      { name: "Expires", value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0xFEE75C)
    .setThumbnail(targetUser.displayAvatarURL())
    .setFooter({ text: `Moderator ID: ${moderator.id}` })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log timeout removal
async function logUntimeout(guild, targetUser, moderator, reason, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("🔊 Timeout Removed")
    .setDescription(`**Member:** ${targetUser} (${targetUser.tag})\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "User ID", value: targetUser.id, inline: true },
      { name: "Moderator ID", value: moderator.id, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0x57F287)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log kick action
async function logKick(guild, targetUser, moderator, reason, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("👢 Member Kicked")
    .setDescription(`**Member:** ${targetUser.tag}\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "User ID", value: targetUser.id, inline: true },
      { name: "Moderator ID", value: moderator.id, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0xF26522)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log ban action
async function logBan(guild, targetUser, moderator, reason, deleteMessageDays, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("🔨 Member Banned")
    .setDescription(`**Member:** ${targetUser.tag}\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "User ID", value: targetUser.id, inline: true },
      { name: "Moderator ID", value: moderator.id, inline: true },
      { name: "Messages Deleted", value: `${deleteMessageDays} day(s)`, inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0xED4245)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log softban action
async function logSoftban(guild, targetUser, moderator, reason, deleteMessageDays, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("🔄 Member Soft-Banned")
    .setDescription(`**Member:** ${targetUser.tag}\n**Moderator:** ${moderator}\n\n*User was banned and immediately unbanned to clear messages*`)
    .addFields(
      { name: "User ID", value: targetUser.id, inline: true },
      { name: "Moderator ID", value: moderator.id, inline: true },
      { name: "Messages Deleted", value: `${deleteMessageDays} day(s)`, inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0xF26522)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log unban action
async function logUnban(guild, targetUser, moderator, reason, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.moderation === false) return;

  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("✅ Member Unbanned")
    .setDescription(`**User ID:** ${targetUser.id}\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "Moderator ID", value: moderator.id, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setColor(0x57F287)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Log bulk message delete (nuke)
async function logBulkDelete(channel, count, moderator, targetUser, config) {
  if (!config.audit_log_channel_id) return;
  if (!config.logging || config.logging.message_bulk_delete === false) return;

  const logChannel = channel.guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("🧹 Bulk Message Delete")
    .setDescription(`**Channel:** ${channel}\n**Moderator:** ${moderator}`)
    .addFields(
      { name: "Messages Deleted", value: count.toString(), inline: true },
      { name: "Target User", value: targetUser ? `${targetUser.tag}` : "All users", inline: true },
      { name: "Moderator ID", value: moderator.id, inline: true }
    )
    .setColor(0xFF4500)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Helper function to format duration
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

module.exports = {
  logMemberJoin,
  logMemberLeave,
  logRoleUpdate,
  logMessageDelete,
  logMessageEdit,
  cacheMessage,
  logTimeout,
  logUntimeout,
  logKick,
  logBan,
  logSoftban,
  logUnban,
  logBulkDelete,
};

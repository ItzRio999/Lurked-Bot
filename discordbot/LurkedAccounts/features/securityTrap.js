const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { purgeUserMessagesLastDays } = require("./messagePurge");
const { saveJson, DATA_PATH } = require("../utils/fileManager");

const SECURITY_TRAP_CHANNEL_ID = "1477816832718012569";
const SECURITY_REVIEW_CHANNEL_ID = "1477818550063468704";
const SECURITY_TIMEOUT_MS = 42 * 60 * 60 * 1000; // 42 hours
const EMBED_TITLE = "DO NOT TYPE IN THIS CHANNEL.";

// Module-level state set once on init
let _data = null;
let _config = null;

function initSecurityTrap(data, config) {
  _data = data;
  _config = config;
}

function formatUptime(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function truncate(text, max = 1024) {
  if (!text) return "None";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function formatAttachments(message) {
  if (!message.attachments || message.attachments.size === 0) return "None";
  return message.attachments
    .map((attachment) => `[${attachment.name || "attachment"}](${attachment.url})`)
    .join("\n")
    .slice(0, 1024);
}

function createSecurityNoticeEmbed() {
  const stats = _data?.security_trap_stats || {};
  const totalBans = (stats.auto_bans || 0) + (stats.manual_bans || 0);
  const startTime = stats.bot_start_time || Date.now();
  const currentUptimeMs = Date.now() - startTime;
  const longestUptimeMs = Math.max(stats.longest_uptime_ms || 0, currentUptimeMs);

  const embed = new EmbedBuilder()
    .setTitle(EMBED_TITLE)
    .setDescription(
      "When people get hacked, they spam in every channel. This is to prevent the spread of spam and protect the server.\n\nTyping in this channel will result in a **timeout** or **ban**."
    )
    .addFields(
      { name: "I've Banned", value: `\`» ${totalBans} Account${totalBans !== 1 ? "s" : ""}\``, inline: true },
      { name: "Uptime", value: `\`» ${formatUptime(currentUptimeMs)}\``, inline: true },
      { name: "Longest uptime", value: `\`» ${formatUptime(longestUptimeMs)}\``, inline: true }
    )
    .setColor(0xED4245)
    .setFooter({ text: "Developed by Sxloar ₉₉₉" });

  if (_config?.logo_url) {
    embed.setThumbnail(_config.logo_url);
  }

  return embed;
}

async function clearChannelMessages(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages || messages.size === 0) return;

  const bulkDeletable = messages.filter((m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
  if (bulkDeletable.size > 0) {
    await channel.bulkDelete(bulkDeletable, true).catch(() => {});
  }

  const oldMessages = messages.filter((m) => !bulkDeletable.has(m.id));
  for (const oldMessage of oldMessages.values()) {
    if (oldMessage.deletable) {
      await oldMessage.delete().catch(() => {});
    }
  }
}

async function resetSecurityTrapChannel(channel) {
  await clearChannelMessages(channel);
  await channel.send({ embeds: [createSecurityNoticeEmbed()] }).catch(() => {});
}

async function logToAuditChannel(guild, config, embed) {
  if (!config.audit_log_channel_id) return;
  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function handleEveryoneBan(message, config) {
  const reason = "Security trap triggered: @everyone used in protected channel (possible compromise/scam behavior).";
  const targetUser = message.author;

  try {
    await targetUser
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle("You Were Banned")
            .setDescription(`You were banned from **${message.guild.name}**.`)
            .addFields({ name: "Reason", value: reason })
            .setColor(0xED4245),
        ],
      })
      .catch(() => {});

    await message.guild.bans.create(targetUser.id, {
      reason,
      deleteMessageSeconds: 7 * 86400,
    });
    await purgeUserMessagesLastDays(message.guild, targetUser.id, 7).catch(() => {});

    if (_data) {
      if (!_data.security_trap_stats) _data.security_trap_stats = {};
      _data.security_trap_stats.auto_bans = (_data.security_trap_stats.auto_bans || 0) + 1;
      saveJson(DATA_PATH, _data);
    }

    const auditEmbed = new EmbedBuilder()
      .setTitle("Security Trap: User Auto-Banned")
      .setColor(0xED4245)
      .addFields(
        { name: "User", value: `${targetUser} (${targetUser.tag})`, inline: true },
        { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
        { name: "Action", value: "Ban", inline: true },
        { name: "Reason", value: reason, inline: false },
        { name: "Message Content", value: truncate(message.content || "No text content"), inline: false },
        { name: "Attachments", value: formatAttachments(message), inline: false }
      )
      .setTimestamp();

    await logToAuditChannel(message.guild, config, auditEmbed);
  } catch (error) {
    console.error("Security trap auto-ban failed:", error);
  }
}

async function handleTimeoutReview(message) {
  const reason = "Typed in protected security channel without @everyone mention.";

  try {
    let timeoutApplied = false;
    if (message.member && message.member.moderatable) {
      try {
        await message.member.timeout(SECURITY_TIMEOUT_MS, reason);
        timeoutApplied = true;
      } catch {
        timeoutApplied = false;
      }
    }

    if (timeoutApplied) {
      await purgeUserMessagesLastDays(message.guild, message.author.id, 7).catch(() => {});
    }

    await message.author
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle("You Were Timed Out")
            .setDescription(`You were timed out in **${message.guild.name}**.`)
            .addFields(
              { name: "Duration", value: "42 hours", inline: true },
              { name: "Reason", value: reason, inline: false }
            )
            .setColor(0x5865F2),
        ],
      })
      .catch(() => {});

    const reviewChannel = message.guild.channels.cache.get(SECURITY_REVIEW_CHANNEL_ID);
    if (!reviewChannel) return;

    const caseId = message.id;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`securitytrap_ban_${message.author.id}_${caseId}`)
        .setLabel("Ban User")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`securitytrap_keep_${message.author.id}_${caseId}`)
        .setLabel("No Ban")
        .setStyle(ButtonStyle.Secondary)
    );

    const reviewEmbed = new EmbedBuilder()
      .setTitle("Security Trap: Manual Review")
      .setDescription("User typed in the protected security channel without `@everyone`.")
      .setColor(0xFEE75C)
      .addFields(
        { name: "User", value: `${message.author} (${message.author.tag})`, inline: true },
        { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
        { name: "Action Taken", value: "Timeout (42h)", inline: true },
        { name: "Message Content", value: truncate(message.content || "No text content"), inline: false },
        { name: "Attachments", value: formatAttachments(message), inline: false },
        { name: "Case ID", value: caseId, inline: false }
      )
      .setTimestamp();

    await reviewChannel.send({ embeds: [reviewEmbed], components: [row] }).catch(() => {});
  } catch (error) {
    console.error("Security trap timeout review failed:", error);
  }
}

async function handleSecurityTrapMessage(message, config) {
  if (!message.guild || message.author.bot) return false;
  if (message.channel.id !== SECURITY_TRAP_CHANNEL_ID) return false;

  const containsEveryone = message.mentions.everyone || (message.content || "").includes("@everyone");

  if (containsEveryone) {
    await handleEveryoneBan(message, config);
  } else {
    await handleTimeoutReview(message);
  }

  await resetSecurityTrapChannel(message.channel);
  return true;
}

function buildDecisionReasonModal(action, userId, caseId, reviewMessageId) {
  const actionLabel = action === "ban" ? "Ban" : "No Ban";
  const modal = new ModalBuilder()
    .setCustomId(`securitytrap_submit_${action}_${userId}_${caseId}_${reviewMessageId}`)
    .setTitle(`Security Trap ${actionLabel} Reason`);

  const reasonInput = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Reason")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(3)
    .setMaxLength(500)
    .setPlaceholder("Enter the reason shown in DMs and moderation logs.")
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(reasonInput);
  modal.addComponents(row);
  return modal;
}

async function handleDecisionButton(interaction) {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const userId = parts[2];
  const caseId = parts[3];

  if (!action || !userId || !caseId) {
    await interaction.reply({ content: "Invalid security action data.", flags: MessageFlags.Ephemeral });
    return true;
  }

  if (action !== "ban" && action !== "keep") {
    await interaction.reply({ content: "Unsupported security action.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const modal = buildDecisionReasonModal(action, userId, caseId, interaction.message.id);
  await interaction.showModal(modal);
  return true;
}

async function handleDecisionModal(interaction) {
  const parts = interaction.customId.split("_");
  const action = parts[2];
  const userId = parts[3];
  const caseId = parts[4];
  const reviewMessageId = parts[5];

  if (!action || !userId || !caseId || !reviewMessageId) {
    await interaction.reply({ content: "Invalid security decision submission.", flags: MessageFlags.Ephemeral });
    return true;
  }

  if (action !== "ban" && action !== "keep") {
    await interaction.reply({ content: "Unsupported security action.", flags: MessageFlags.Ephemeral });
    return true;
  }

  // Defer immediately — ban/purge/edits can take several seconds and the 3s window expires
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reason = interaction.fields.getTextInputValue("reason").trim();
  const decisionMessage = interaction.channel?.messages?.cache?.get(reviewMessageId)
    || await interaction.channel?.messages?.fetch(reviewMessageId).catch(() => null);

  if (!decisionMessage) {
    await interaction.editReply({ content: "Could not find the review message for this decision." });
    return true;
  }

  const disabledRows = decisionMessage.components.map((row) =>
    ActionRowBuilder.from(row).setComponents(
      ...row.components.map((component) => ButtonBuilder.from(component).setDisabled(true))
    )
  );

  const embed = EmbedBuilder.from(decisionMessage.embeds[0]);
  embed.addFields(
    {
      name: "Moderator Decision",
      value: action === "ban" ? `Banned by ${interaction.user}` : `No ban by ${interaction.user}`,
      inline: false,
    },
    {
      name: "Reason",
      value: truncate(reason, 1024),
      inline: false,
    }
  );
  embed.setColor(action === "ban" ? 0xED4245 : 0x57F287).setTimestamp();

  const user = await interaction.client.users.fetch(userId).catch(() => null);

  if (action === "ban") {
    if (user) {
      await user
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("You Were Banned")
              .setDescription(`You were banned from **${interaction.guild.name}**.`)
              .addFields({ name: "Reason", value: truncate(reason, 1024) })
              .setColor(0xED4245),
          ],
        })
        .catch(() => {});
    }

    await interaction.guild.bans.create(userId, {
      reason: `Security trap review ban by ${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: 7 * 86400,
    }).catch(() => {});
    await purgeUserMessagesLastDays(interaction.guild, userId, 7).catch(() => {});

    if (_data) {
      if (!_data.security_trap_stats) _data.security_trap_stats = {};
      _data.security_trap_stats.manual_bans = (_data.security_trap_stats.manual_bans || 0) + 1;
      saveJson(DATA_PATH, _data);
    }
  }

  if (action === "keep") {
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    let timeoutRemoved = false;

    if (member && member.communicationDisabledUntilTimestamp) {
      await member.timeout(null, `Timeout removed by ${interaction.user.tag}: ${reason}`).catch(() => {});
      timeoutRemoved = true;
    }

    if (user) {
      await user
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle(timeoutRemoved ? "Your Timeout Was Removed" : "Security Trap Review Complete")
              .setDescription(
                timeoutRemoved
                  ? `Your timeout in **${interaction.guild.name}** has been removed after review.`
                  : `Your case in **${interaction.guild.name}** was reviewed and no ban was applied.`
              )
              .addFields({ name: "Reason", value: truncate(reason, 1024) })
              .setColor(0x57F287),
          ],
        })
        .catch(() => {});
    }
  }

  await decisionMessage.edit({
    embeds: [embed],
    components: disabledRows,
  }).catch(() => {});

  await interaction.editReply({
    content: `Security trap decision recorded: ${action === "ban" ? "ban" : "no ban"}.`,
  });

  return true;
}

async function handleSecurityTrapDecision(interaction) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith("securitytrap_")) return false;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({ content: "You need `Ban Members` permission to use this action.", flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton()) return handleDecisionButton(interaction);
  return handleDecisionModal(interaction);
}

async function ensureSecurityTrapNotice(client) {
  // Keep longest_uptime_ms up to date
  if (_data) {
    if (!_data.security_trap_stats) _data.security_trap_stats = {};
    const stats = _data.security_trap_stats;
    const startTime = stats.bot_start_time || Date.now();
    const currentUptimeMs = Date.now() - startTime;
    if (currentUptimeMs > (stats.longest_uptime_ms || 0)) {
      stats.longest_uptime_ms = currentUptimeMs;
      saveJson(DATA_PATH, _data);
    }
  }

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.get(SECURITY_TRAP_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (!recent || recent.size === 0) {
      await channel.send({ embeds: [createSecurityNoticeEmbed()] }).catch(() => {});
      continue;
    }

    const expectedNotice = recent.find((msg) => {
      if (msg.author.id !== client.user.id) return false;
      const firstEmbed = msg.embeds?.[0];
      return firstEmbed && firstEmbed.title === EMBED_TITLE;
    });

    if (recent.size !== 1 || !expectedNotice) {
      await resetSecurityTrapChannel(channel);
    } else {
      // Refresh uptime and ban stats in the existing embed
      await expectedNotice.edit({ embeds: [createSecurityNoticeEmbed()] }).catch(() => {});
    }
  }
}

module.exports = {
  initSecurityTrap,
  handleSecurityTrapMessage,
  handleSecurityTrapDecision,
  ensureSecurityTrapNotice,
};

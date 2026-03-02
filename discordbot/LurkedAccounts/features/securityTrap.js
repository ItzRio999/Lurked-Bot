const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const SECURITY_TRAP_CHANNEL_ID = "1477816832718012569";
const SECURITY_REVIEW_CHANNEL_ID = "1477818550063468704";
const SECURITY_TIMEOUT_MS = 42 * 60 * 60 * 1000; // 42 hours
const SECURITY_NOTICE_MARKER = "Security Trap Notice";

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
  return new EmbedBuilder()
    .setTitle("Do Not Type In This Channel")
    .setDescription(
      "This channel is reserved for security monitoring.\n\nTyping here will trigger moderation actions."
    )
    .setColor(0xED4245)
    .setFooter({ text: SECURITY_NOTICE_MARKER });
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
      deleteMessageSeconds: 86400,
    });

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
    if (message.member && message.member.moderatable) {
      await message.member.timeout(SECURITY_TIMEOUT_MS, reason).catch(() => {});
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

function disableDecisionButtons(interaction) {
  const rows = interaction.message.components.map((row) =>
    ActionRowBuilder.from(row).setComponents(
      ...row.components.map((component) => ButtonBuilder.from(component).setDisabled(true))
    )
  );
  return rows;
}

async function handleSecurityTrapDecision(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("securitytrap_")) return false;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({ content: "You need `Ban Members` permission to use this button.", ephemeral: true });
    return true;
  }

  const parts = interaction.customId.split("_");
  const action = parts[1];
  const userId = parts[2];

  if (!action || !userId) {
    await interaction.reply({ content: "Invalid security action data.", ephemeral: true });
    return true;
  }

  const disabledRows = disableDecisionButtons(interaction);
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  embed.addFields({
    name: "Moderator Decision",
    value: action === "ban" ? `Banned by ${interaction.user}` : `No ban by ${interaction.user}`,
    inline: false,
  });
  embed.setColor(action === "ban" ? 0xED4245 : 0x57F287).setTimestamp();

  if (action === "ban") {
    const reason = "Manual ban from security trap review after protected channel trigger.";
    const user = await interaction.client.users.fetch(userId).catch(() => null);

    if (user) {
      await user
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("You Were Banned")
              .setDescription(`You were banned from **${interaction.guild.name}**.`)
              .addFields({ name: "Reason", value: reason })
              .setColor(0xED4245),
          ],
        })
        .catch(() => {});
    }

    await interaction.guild.bans.create(userId, {
      reason,
      deleteMessageSeconds: 86400,
    }).catch(() => {});
  }

  await interaction.update({
    embeds: [embed],
    components: disabledRows,
  });

  return true;
}

async function ensureSecurityTrapNotice(client) {
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
      return firstEmbed && firstEmbed.footer && firstEmbed.footer.text === SECURITY_NOTICE_MARKER;
    });

    if (recent.size !== 1 || !expectedNotice) {
      await resetSecurityTrapChannel(channel);
    }
  }
}

module.exports = {
  handleSecurityTrapMessage,
  handleSecurityTrapDecision,
  ensureSecurityTrapNotice,
};

const { EmbedBuilder, MessageFlags } = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");
const { hasVerifiedRole } = require("../utils/permissions");
const {
  ensureVouchState,
  formatBytes,
  getMaxImageBytes,
  getMaxVideoBytes,
  upsertUserVouch,
  validateProofAttachment,
} = require("../utils/vouchStore");

const BACKUP_COLLECTION = "vouches_backup";
const BACKUP_DOC = "latest";

function getStarString(stars) {
  return "⭐".repeat(Math.min(5, Math.max(1, stars)));
}

function getFirestore() {
  const admin = require("firebase-admin");
  if (!admin.apps.length) throw new Error("Firebase Admin not initialized");
  return admin.firestore();
}

async function submitVouch(interaction, config, configPath, data, dataPath) {
  if (!config.vouch || !config.vouch.enabled || !config.vouch.channel_id) {
    const embed = new EmbedBuilder()
      .setDescription("❌ The vouch system is not set up yet. An admin needs to run `/vouchsetup channel` first.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const verifiedRoleId = config?.verification?.verified_role_id || "1451251793303703616";
  if (!hasVerifiedRole(interaction.member, config)) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ You need the <@&${verifiedRoleId}> role to submit a vouch.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const vouchMessage = interaction.options.getString("message", true);
  const stars = interaction.options.getInteger("stars", true);
  const proof = interaction.options.getAttachment("proof");

  const proofValidation = validateProofAttachment(proof);
  if (!proofValidation.ok) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ ${proofValidation.error}`)
      .addFields({
        name: "Proof limits",
        value: `Images: ${formatBytes(getMaxImageBytes())} max\nVideos: ${formatBytes(getMaxVideoBytes())} max`,
        inline: false,
      })
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  ensureVouchState(data);
  const previousVouch = data.vouches.find((vouch) => vouch.user_id === interaction.user.id) || null;
  data.vouch_counter += 1;

  const vouchNumber = data.vouch_counter;
  const timestamp = new Date();
  const timestampUnix = Math.floor(timestamp.getTime() / 1000);
  const isVideo = proofValidation.proofType === "video";
  const isImage = proofValidation.proofType === "image";

  const vouchChannel = interaction.guild.channels.cache.get(config.vouch.channel_id);
  if (!vouchChannel) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Vouch channel not found! Ask an admin to re-run `/vouchsetup channel`.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const footer = config.vouch.footer || `${interaction.guild.name}, All Rights Reserved.`;
  const embedColor = config.vouch.embed_color || 0x522081;

  const vouchEmbed = new EmbedBuilder()
    .setTitle(previousVouch ? "Vouch updated!" : "New vouch created!")
    .setDescription(getStarString(stars))
    .addFields(
      { name: "Vouch:", value: vouchMessage, inline: false },
      { name: "Vouch No.", value: `${vouchNumber}`, inline: true },
      { name: "Vouched by:", value: `@${interaction.user.username}`, inline: true },
      { name: "Vouched at:", value: `<t:${timestampUnix}:F>`, inline: true }
    )
    .setColor(embedColor)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128, extension: "png" }))
    .setFooter({
      text: footer,
      iconURL: interaction.guild.iconURL({ extension: "png" }) || undefined,
    })
    .setTimestamp();

  if (isImage) {
    vouchEmbed.setImage(proof.url);
  }

  const sentMessage = await vouchChannel.send({
    embeds: [vouchEmbed],
    content: isVideo ? `📹 **Proof:** ${proof.url}` : undefined,
  });

  if (previousVouch?.channel_message_id) {
    try {
      const previousMessage = await vouchChannel.messages.fetch(previousVouch.channel_message_id);
      await previousMessage.delete();
    } catch (error) {
      console.warn("Failed to delete previous vouch message:", error.message);
    }
  }

  upsertUserVouch(data, {
    id: vouchNumber,
    user_id: interaction.user.id,
    user_tag: interaction.user.tag,
    message: vouchMessage,
    stars,
    proof_url: proof ? proof.url : null,
    proof_type: proofValidation.proofType,
    proof_size: proofValidation.proofSize,
    proof_name: proof?.name || null,
    timestamp: timestamp.toISOString(),
    guild_id: interaction.guild.id,
    channel_message_id: sentMessage.id,
  });
  saveJson(dataPath, data);

  const confirmEmbed = new EmbedBuilder()
    .setDescription(
      previousVouch
        ? `✅ Your previous vouch was replaced. Check <#${config.vouch.channel_id}> to see the updated version.`
        : `✅ Your vouch has been submitted! Check <#${config.vouch.channel_id}> to see it.`
    )
    .setColor(0x57F287);
  return interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
}

async function setupVouchSystem(interaction, config, configPath) {
  const subcommand = interaction.options.getSubcommand();

  if (!config.vouch) {
    config.vouch = {
      enabled: false,
      channel_id: null,
      cmd_channel_id: null,
      embed_color: null,
      footer: null,
    };
  }

  if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel", true);
    config.vouch.channel_id = channel.id;
    config.vouch.enabled = true;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setTitle("Vouch System Configured")
        .addFields(
          { name: "Vouch Channel", value: `${channel}`, inline: true },
          { name: "Status", value: "✅ Enabled", inline: true },
          { name: "Next Steps", value: "• Use `/vouchsetup cmdchannel` to restrict where users can submit vouches\n• Users run `/vouch` to leave a review", inline: false }
        )
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "cmdchannel") {
    const channel = interaction.options.getChannel("channel", true);
    config.vouch.cmd_channel_id = channel.id;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ The \`/vouch\` command is now restricted to ${channel}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "removecmdchannel") {
    config.vouch.cmd_channel_id = null;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("✅ Command channel restriction removed. `/vouch` can now be used in any channel.")
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "footer") {
    const footerText = interaction.options.getString("text", true);
    config.vouch.footer = footerText;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Vouch embed footer set to: **${footerText}**`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "disable") {
    config.vouch.enabled = false;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("✅ Vouch system disabled. Use `/vouchsetup channel` to re-enable.")
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === "status") {
    const v = config.vouch;
    const isEnabled = v && v.enabled;
    const vouchChannel = v?.channel_id ? `<#${v.channel_id}>` : "Not set";
    const cmdChannel = v?.cmd_channel_id ? `<#${v.cmd_channel_id}>` : "Any channel";
    const footer = v?.footer || "Default (server name)";

    const embed = addLogo(
      new EmbedBuilder()
        .setTitle("Vouch System Status")
        .addFields(
          { name: "Status", value: isEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          { name: "Vouch Channel", value: vouchChannel, inline: true },
          { name: "Command Channel", value: cmdChannel, inline: true },
          { name: "Footer Text", value: footer, inline: false }
        )
        .setColor(isEnabled ? 0x57F287 : 0xED4245),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function backupVouches(interaction, data, dataPath) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const db = getFirestore();
    ensureVouchState(data);
    const vouches = Array.isArray(data.vouches) ? data.vouches : [];
    const backed_up_at = new Date().toISOString();

    await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).set({
      vouches,
      vouch_counter: data.vouch_counter || vouches.length,
      backed_up_at,
      total: vouches.length,
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Vouch Backup Complete")
      .setDescription(`Successfully backed up **${vouches.length}** vouch${vouches.length !== 1 ? "es" : ""} to Firebase Firestore.`)
      .addFields({ name: "Timestamp", value: `<t:${Math.floor(new Date(backed_up_at).getTime() / 1000)}:F>`, inline: true })
      .setColor(0x57F287);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("vouchbackup error:", err);
    const embed = new EmbedBuilder()
      .setDescription(`❌ Backup failed: ${err.message}`)
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }
}

async function restoreVouches(interaction, data, dataPath) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const db = getFirestore();
    const snapshot = await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).get();

    if (!snapshot.exists) {
      const embed = new EmbedBuilder()
        .setDescription("❌ No backup found in Firebase Firestore. Run `/vouchbackup` first.")
        .setColor(0xED4245);
      return interaction.editReply({ embeds: [embed] });
    }

    const backup = snapshot.data();
    data.vouches = backup.vouches || [];
    data.vouch_counter = backup.vouch_counter ?? data.vouches.length;
    ensureVouchState(data);
    saveJson(dataPath, data);

    const ts = Math.floor(new Date(backup.backed_up_at).getTime() / 1000);
    const embed = new EmbedBuilder()
      .setTitle("✅ Vouch Restore Complete")
      .setDescription(`Restored **${data.vouches.length}** vouch${data.vouches.length !== 1 ? "es" : ""} from backup.`)
      .addFields({ name: "Backup created", value: `<t:${ts}:F>`, inline: true })
      .setColor(0x57F287);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("vouchrestore error:", err);
    const embed = new EmbedBuilder()
      .setDescription(`❌ Restore failed: ${err.message}`)
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { submitVouch, setupVouchSystem, backupVouches, restoreVouches };

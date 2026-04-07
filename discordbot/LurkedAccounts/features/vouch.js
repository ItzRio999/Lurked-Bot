const { EmbedBuilder, MessageFlags, ChannelType } = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");
const { hasVerifiedRole } = require("../utils/permissions");

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "mp4"];

function getStarString(stars) {
  return "⭐".repeat(Math.min(5, Math.max(1, stars)));
}

function getColorByStars(stars) {
  if (stars >= 5) return 0xF1C40F; // Gold
  if (stars >= 4) return 0xE67E22; // Orange
  if (stars >= 3) return 0x3498DB; // Blue
  if (stars >= 2) return 0x95A5A6; // Gray
  return 0xED4245;                 // Red
}

async function submitVouch(interaction, config, configPath, data, dataPath) {
  // Check if vouch system is configured and enabled
  if (!config.vouch || !config.vouch.enabled || !config.vouch.channel_id) {
    const embed = new EmbedBuilder()
      .setDescription("❌ The vouch system is not set up yet. An admin needs to run `/vouchsetup channel` first.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Enforce role requirement
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

  // Validate proof attachment
  if (proof) {
    const ext = proof.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const embed = new EmbedBuilder()
        .setDescription("❌ Invalid proof file type! Allowed: PNG, JPG, JPEG, WEBP, GIF, MP4")
        .setColor(0xED4245);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  // Increment counters
  if (!data.vouches) data.vouches = [];
  if (!data.vouch_counter) data.vouch_counter = 0;
  data.vouch_counter++;

  const vouchNumber = data.vouch_counter;
  const timestamp = new Date();
  const timestampUnix = Math.floor(timestamp.getTime() / 1000);

  const isVideo = proof && proof.name.toLowerCase().endsWith(".mp4");
  const isImage = proof && !isVideo;

  // Save vouch record
  data.vouches.push({
    id: vouchNumber,
    user_id: interaction.user.id,
    user_tag: interaction.user.tag,
    message: vouchMessage,
    stars,
    proof_url: proof ? proof.url : null,
    proof_type: isVideo ? "video" : isImage ? "image" : null,
    timestamp: timestamp.toISOString(),
    guild_id: interaction.guild.id,
  });
  saveJson(dataPath, data);

  // Fetch the output channel
  const vouchChannel = interaction.guild.channels.cache.get(config.vouch.channel_id);
  if (!vouchChannel) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Vouch channel not found! Ask an admin to re-run `/vouchsetup channel`.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Build vouch embed
  const footer = config.vouch.footer || `${interaction.guild.name}, All Rights Reserved.`;
  const embedColor = config.vouch.embed_color || 0x522081;

  const vouchEmbed = new EmbedBuilder()
    .setTitle("New vouch created!")
    .setDescription(getStarString(stars))
    .addFields(
      { name: "Vouch:", value: vouchMessage, inline: false },
      { name: "Vouch N°", value: `${vouchNumber}`, inline: true },
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

  // Send to vouch channel; video proofs are appended as a URL so Discord auto-embeds them
  await vouchChannel.send({
    embeds: [vouchEmbed],
    content: isVideo ? `📹 **Proof:** ${proof.url}` : undefined,
  });

  // Ephemeral confirmation
  const confirmEmbed = new EmbedBuilder()
    .setDescription(`✅ Your vouch has been submitted! Check <#${config.vouch.channel_id}> to see it.`)
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

const BACKUP_COLLECTION = 'vouches_backup';
const BACKUP_DOC = 'latest';

function getFirestore() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
  return admin.firestore();
}

async function backupVouches(interaction, data, dataPath) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const db = getFirestore();
    const vouches = Array.isArray(data.vouches) ? data.vouches : [];
    const backed_up_at = new Date().toISOString();

    await db.collection(BACKUP_COLLECTION).doc(BACKUP_DOC).set({
      vouches,
      vouch_counter: data.vouch_counter || vouches.length,
      backed_up_at,
      total: vouches.length,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Vouch Backup Complete')
      .setDescription(`Successfully backed up **${vouches.length}** vouch${vouches.length !== 1 ? 'es' : ''} to Firebase Firestore.`)
      .addFields({ name: 'Timestamp', value: `<t:${Math.floor(new Date(backed_up_at).getTime() / 1000)}:F>`, inline: true })
      .setColor(0x57F287);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('❌ vouchbackup error:', err);
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
        .setDescription('❌ No backup found in Firebase Firestore. Run `/vouchbackup` first.')
        .setColor(0xED4245);
      return interaction.editReply({ embeds: [embed] });
    }

    const backup = snapshot.data();
    data.vouches = backup.vouches || [];
    data.vouch_counter = backup.vouch_counter ?? data.vouches.length;
    saveJson(dataPath, data);

    const ts = Math.floor(new Date(backup.backed_up_at).getTime() / 1000);
    const embed = new EmbedBuilder()
      .setTitle('✅ Vouch Restore Complete')
      .setDescription(`Restored **${data.vouches.length}** vouch${data.vouches.length !== 1 ? 'es' : ''} from backup.`)
      .addFields({ name: 'Backup created', value: `<t:${ts}:F>`, inline: true })
      .setColor(0x57F287);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('❌ vouchrestore error:', err);
    const embed = new EmbedBuilder()
      .setDescription(`❌ Restore failed: ${err.message}`)
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { submitVouch, setupVouchSystem, backupVouches, restoreVouches };

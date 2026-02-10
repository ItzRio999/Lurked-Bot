const { EmbedBuilder, MessageFlags } = require("discord.js");
const { saveJson } = require("../utils/fileManager");
const { mention } = require("../utils/permissions");

const UNIT_MS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
};

const MAX_DURATIONS = {
  minutes: 43200,  // 30 days in minutes
  hours: 720,      // 30 days in hours
  days: 30,
  weeks: 4,
  months: 1,
};

// Send a log embed to the audit log channel
async function sendLog(guild, config, embed) {
  if (!config.audit_log_channel_id) return;
  const logChannel = guild.channels.cache.get(config.audit_log_channel_id);
  if (!logChannel) return;
  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// Assign a timed role to a user
async function assignTimedRole(interaction, data, dataPath, config) {
  const targetUser = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true);
  const duration = interaction.options.getInteger("duration", true);
  const unit = interaction.options.getString("unit") || "hours";

  // Validation
  if (duration < 1) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Duration must be at least 1!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (duration > MAX_DURATIONS[unit]) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ Maximum duration is ${MAX_DURATIONS[unit]} ${unit}.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Can't assign @everyone
  if (role.id === interaction.guild.id) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Cannot assign the @everyone role!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Check bot can manage this role
  const botMember = interaction.guild.members.me;
  if (botMember.roles.highest.position <= role.position) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ I can't assign ${role} — it's higher than or equal to my highest role.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Check if user already has an active timed entry for this role
  if (!data.timed_roles) data.timed_roles = [];
  const existing = data.timed_roles.find(
    (tr) => tr.user_id === targetUser.id && tr.role_id === role.id && !tr.expired
  );
  if (existing) {
    const embed = new EmbedBuilder()
      .setDescription(
        `❌ ${mention(targetUser.id)} already has a timed assignment for ${role}. Remove it first with \`/timedroleremove\`.`
      )
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    await member.roles.add(role, `Timed role assigned by ${interaction.user.tag} for ${duration} ${unit}`);
  } catch (error) {
    console.error("Error assigning timed role:", error);
    const embed = new EmbedBuilder()
      .setDescription("❌ Failed to assign the role. Check bot permissions.")
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }

  const expireTime = Date.now() + duration * UNIT_MS[unit];
  const expireTimestamp = Math.floor(expireTime / 1000);

  data.timed_roles.push({
    user_id: targetUser.id,
    role_id: role.id,
    guild_id: interaction.guild.id,
    assigned_by: interaction.user.id,
    assigned_at: new Date().toISOString(),
    expire_time: expireTime,
    expired: false,
  });
  saveJson(dataPath, data);

  const embed = new EmbedBuilder()
    .setTitle("Timed Role Assigned")
    .setDescription(
      `${mention(targetUser.id)} has been given ${role} for **${duration} ${unit}**.`
    )
    .addFields(
      { name: "Expires", value: `<t:${expireTimestamp}:F> (<t:${expireTimestamp}:R>)`, inline: true },
      { name: "Assigned By", value: mention(interaction.user.id), inline: true }
    )
    .setColor(0x57F287)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Log to audit channel
  const logEmbed = new EmbedBuilder()
    .setTitle("Timed Role Assigned")
    .setDescription(
      `${mention(interaction.user.id)} assigned a timed role.`
    )
    .addFields(
      { name: "User", value: `${mention(targetUser.id)} (${targetUser.id})`, inline: true },
      { name: "Role", value: `${role} (${role.id})`, inline: true },
      { name: "Duration", value: `${duration} ${unit}`, inline: true },
      { name: "Expires", value: `<t:${expireTimestamp}:F> (<t:${expireTimestamp}:R>)`, inline: false }
    )
    .setColor(0x57F287)
    .setTimestamp();

  await sendLog(interaction.guild, config, logEmbed);
}

// Manually remove a timed role early
async function removeTimedRole(interaction, data, dataPath, config) {
  const targetUser = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true);

  if (!data.timed_roles) data.timed_roles = [];

  const entry = data.timed_roles.find(
    (tr) => tr.user_id === targetUser.id && tr.role_id === role.id && !tr.expired
  );

  if (!entry) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ No active timed role found for ${mention(targetUser.id)} with ${role}.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Remove role
  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, "Timed role removed early by admin");
    }
  } catch (error) {
    console.error("Error removing timed role:", error);
  }

  entry.expired = true;
  saveJson(dataPath, data);

  // DM the user
  try {
    const user = await interaction.client.users.fetch(targetUser.id);
    const dmEmbed = new EmbedBuilder()
      .setTitle("Timed Role Removed")
      .setDescription(
        `Your timed role **${role.name}** in **${interaction.guild.name}** has been removed early by an admin.`
      )
      .setColor(0xF59E42)
      .setTimestamp();
    await user.send({ embeds: [dmEmbed] }).catch(() => {});
  } catch (error) {
    // Can't DM user, not critical
  }

  const embed = new EmbedBuilder()
    .setDescription(`✅ Removed timed role ${role} from ${mention(targetUser.id)}.`)
    .setColor(0x57F287);
  await interaction.editReply({ embeds: [embed] });

  // Log to audit channel
  const logEmbed = new EmbedBuilder()
    .setTitle("Timed Role Removed Early")
    .setDescription(
      `${mention(interaction.user.id)} removed a timed role early.`
    )
    .addFields(
      { name: "User", value: `${mention(targetUser.id)} (${targetUser.id})`, inline: true },
      { name: "Role", value: `${role} (${role.id})`, inline: true },
      { name: "Originally Assigned By", value: mention(entry.assigned_by), inline: true }
    )
    .setColor(0xF59E42)
    .setTimestamp();

  await sendLog(interaction.guild, config, logEmbed);
}

// List all active timed roles
async function listTimedRoles(interaction, data) {
  if (!data.timed_roles) data.timed_roles = [];

  const active = data.timed_roles.filter(
    (tr) => !tr.expired && tr.guild_id === interaction.guild.id
  );

  if (active.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("No active timed roles in this server.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const lines = active.map((tr, i) => {
    const expireTimestamp = Math.floor(tr.expire_time / 1000);
    return `**${i + 1}.** ${mention(tr.user_id)} — <@&${tr.role_id}>\n   Expires <t:${expireTimestamp}:R> • Assigned by ${mention(tr.assigned_by)}`;
  });

  const description = lines.join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`Active Timed Roles (${active.length})`)
    .setDescription(description.length > 4000 ? description.slice(0, 4000) + "\n..." : description)
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// Periodic check — remove expired timed roles, DM users, and log to channel
async function checkTimedRoles(client, data, dataPath, config) {
  if (!data.timed_roles || !Array.isArray(data.timed_roles) || data.timed_roles.length === 0) return;

  const now = Date.now();
  const expired = data.timed_roles.filter((tr) => !tr.expired && tr.expire_time <= now);

  if (expired.length === 0) return;

  for (const entry of expired) {
    entry.expired = true;

    try {
      const guild = client.guilds.cache.get(entry.guild_id);
      if (!guild) continue;

      const role = guild.roles.cache.get(entry.role_id);
      const roleName = role ? role.name : "Unknown Role";

      // Remove the role
      try {
        const member = await guild.members.fetch(entry.user_id);
        if (member && role && member.roles.cache.has(entry.role_id)) {
          await member.roles.remove(role, "Timed role expired");
        }
      } catch (error) {
        console.error(`Failed to remove timed role from ${entry.user_id}:`, error.message);
      }

      // DM the user
      try {
        const user = await client.users.fetch(entry.user_id);
        const dmEmbed = new EmbedBuilder()
          .setTitle("Timed Role Expired")
          .setDescription(
            `Your timed role **${roleName}** in **${guild.name}** has expired and been removed.`
          )
          .setColor(0xF59E42)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (error) {
        // Can't DM user, not critical
      }

      // Log to audit channel
      const logEmbed = new EmbedBuilder()
        .setTitle("Timed Role Expired")
        .setDescription(`A timed role has expired and been removed.`)
        .addFields(
          { name: "User", value: `${mention(entry.user_id)} (${entry.user_id})`, inline: true },
          { name: "Role", value: role ? `${role} (${role.id})` : `${roleName} (${entry.role_id})`, inline: true },
          { name: "Originally Assigned By", value: mention(entry.assigned_by), inline: true }
        )
        .setColor(0xED4245)
        .setTimestamp();

      if (config) {
        await sendLog(guild, config, logEmbed);
      }

      console.log(`⏰ Timed role ${roleName} expired for user ${entry.user_id}`);
    } catch (error) {
      console.error(`Error processing expired timed role:`, error);
    }
  }

  saveJson(dataPath, data);
}

module.exports = {
  assignTimedRole,
  removeTimedRole,
  listTimedRoles,
  checkTimedRoles,
};

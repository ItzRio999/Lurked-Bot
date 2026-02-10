const {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const path = require("path");
const { isOwnerOrCoowner } = require("../utils/permissions");
const { saveJson, addLogo } = require("../utils/fileManager");
const { createTicketPanel, createTicketFromButton, handleClaim, handleClose, handleCloseConfirm, handleCloseCancel, getPanelConfig, DEFAULT_PANEL } = require("../features/tickets_v2");
const { showStaffReport, showStaffStats } = require("../features/staffTracking_v2");
const { showBoostReport, showBoostLog, showCurrentBoosters } = require("../features/boostTracking");
const { createPoll } = require("../features/polls");
const { nukeMessages, timeoutUser, untimeoutUser, kickUser, banUser, softbanUser, unbanUser } = require("../features/moderation");
const { createRolesPanel, handleRoleButton, getRolesPanelConfig } = require("../features/rolesPanel");
const { announceMovie, handleMovieButton, showSchedule, addToSchedule, removeFromSchedule, showStats, showVolumeHelp, createMoviePoll, setEventLive } = require("../features/movieNight");
const { startGiveaway, handleGiveawayButton, endGiveaway, rerollGiveaway, listGiveaways } = require("../features/giveaways");
const { configureAutomod } = require("../features/automod");
const { setTicketPriority, addTicketNote, viewTicketNotes, showRatingModal, handleTicketRating, toggleAutoClose, viewTicketStats, renameTicket, setRatingsChannel, addUserToTicket, removeUserFromTicket, listTicketParticipants } = require("../features/ticketEnhancements");
const { createVerificationPanel, startVerification, handleVerificationAnswer, showVerificationStats, configureVerification, setVerificationChannel, manualVerify, unverifyUser } = require("../features/verification");
const { showSecurityDashboard, showRecentLogs } = require("../features/securityLogs");
const { showEmbedModal, handleEmbedSubmit, showAdvancedEmbedModal, handleAdvancedEmbedSubmit } = require("../features/embedCreator");

async function handleInteraction(interaction, config, data, configPath, dataPath, io) {
  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("ticket_rating_modal_")) {
      return handleTicketRating(interaction, data, dataPath, config);
    }
    if (interaction.customId.startsWith("embed_create_")) {
      return handleEmbedSubmit(interaction, config);
    }
    if (interaction.customId.startsWith("embed_advanced_")) {
      return handleAdvancedEmbedSubmit(interaction, config);
    }
    return;
  }

  // Handle button interactions
  if (interaction.isButton()) {
    // Ticket panel buttons
    if (interaction.customId.startsWith("ticket_")) {
      if (interaction.customId === "ticket_claim") {
        return handleClaim(interaction, data, dataPath, config);
      } else if (interaction.customId === "ticket_close") {
        return handleClose(interaction, config, data, dataPath);
      } else if (interaction.customId === "ticket_close_confirm") {
        return handleCloseConfirm(interaction, config, data, dataPath);
      } else if (interaction.customId === "ticket_close_cancel") {
        return handleCloseCancel(interaction);
      } else if (interaction.customId.startsWith("ticket_rate_")) {
        return showRatingModal(interaction, data);
      } else {
        // Category buttons (ticket_general, ticket_bug, etc.)
        const category = interaction.customId.replace("ticket_", "");
        return createTicketFromButton(interaction, category, config, data, dataPath);
      }
    }

    // Roles panel buttons
    if (interaction.customId.startsWith("role_")) {
      const roleId = interaction.customId.replace("role_", "");
      return handleRoleButton(interaction, roleId, config);
    }

    // Movie night buttons
    if (interaction.customId.startsWith("movie_")) {
      const buttonType = interaction.customId.replace("movie_", "");
      return handleMovieButton(interaction, buttonType, data, dataPath);
    }

    // Giveaway buttons
    if (interaction.customId === "giveaway_enter") {
      return handleGiveawayButton(interaction, data, dataPath);
    }

    // Verification buttons
    if (interaction.customId === "verify_start") {
      return startVerification(interaction, config, data, dataPath);
    }

    if (interaction.customId.startsWith("verify_answer_")) {
      return handleVerificationAnswer(interaction, config, data, dataPath);
    }

    // Security dashboard buttons
    if (interaction.customId === "security_logs_recent") {
      return showRecentLogs(interaction, data, config, false);
    }

    if (interaction.customId === "security_logs_alerts") {
      return showRecentLogs(interaction, data, config, true);
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("❌ This command can only be used in a server!")
        .setColor(0xED4245),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const member = interaction.member;
  const name = interaction.commandName;

  // ============== QUICK SETUP ==============
  if (name === "quicksetup") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "tickets") {
      const { ChannelType } = require("discord.js");
      const category = interaction.options.getChannel("category", true);
      const logChannel = interaction.options.getChannel("logchannel", true);
      const title = interaction.options.getString("title");
      const color = interaction.options.getString("color");

      // Validate category
      if (category.type !== ChannelType.GuildCategory) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`❌ ${category} is not a category! Please select an actual category channel.`)
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Setup channels
      config.ticket_category_id = category.id;
      config.ticket_log_channel_id = logChannel.id;

      // Initialize panel if needed
      if (!config.ticket_panel) {
        const { DEFAULT_PANEL } = require("../features/tickets_v2");
        config.ticket_panel = JSON.parse(JSON.stringify(DEFAULT_PANEL));
      }

      // Apply customizations
      if (title) config.ticket_panel.title = title;
      if (color) config.ticket_panel.color = parseInt(color.replace("#", ""), 16);

      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Ticket System Configured")
          .setDescription(
            `Ticket system is ready.\n\u200b`
          )
          .addFields(
            { name: "Ticket Category", value: `${category}`, inline: true },
            { name: "Log Channel", value: `${logChannel}`, inline: true },
            { name: "Default Buttons", value: "4", inline: true },
            { name: "Features", value: "• Username-based channels\n• Transcripts\n• Auto DM\n• Claim system\n• Logging", inline: false },
            { name: "Next Step", value: "Use `/ticketpanel` to post the panel.\nCustomize with `/ticketsetup panel` or `/ticketsetup addbutton`", inline: false }
          )
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "staff") {
      const role1 = interaction.options.getRole("role1", true);
      const role2 = interaction.options.getRole("role2");
      const role3 = interaction.options.getRole("role3");

      if (!config.staff_role_ids) config.staff_role_ids = [];

      config.staff_role_ids = [role1.id];
      if (role2) config.staff_role_ids.push(role2.id);
      if (role3) config.staff_role_ids.push(role3.id);

      saveJson(configPath, config);

      let roleList = `• ${role1}\n`;
      if (role2) roleList += `• ${role2}\n`;
      if (role3) roleList += `• ${role3}\n`;

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Staff Tracking Enabled")
          .setDescription(
            `Staff tracking is now active.\n\u200b`
          )
          .addFields(
            { name: "Tracked Roles", value: roleList, inline: false },
            { name: "Features", value: "• Message tracking\n• Daily/Weekly/Monthly stats\n• Streak tracking\n• Achievements\n• Milestones", inline: false },
            { name: "View Stats", value: "`/staffreport` - team overview\n`/staffstats` - individual stats", inline: false }
          )
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }
  }

  // ============== USERINFO COMMAND (accessible to verified users) ==============
  if (name === "userinfo") {
    // Check if user has the required role (1451251793303703616)
    const hasRequiredRole = member.roles.cache.has("1451251793303703616");

    if (!hasRequiredRole) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("❌ You need to be verified to use this command!")
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const targetUser = interaction.options.getUser("user") || interaction.user;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("❌ User not found in this server!")
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Get user's roles (excluding @everyone)
    const roles = targetMember.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => role.toString())
      .slice(0, 20); // Limit to 20 roles to avoid embed limits

    // Calculate account age
    const accountCreated = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedServer = Math.floor(targetMember.joinedTimestamp / 1000);
    const accountAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
    const serverAgeDays = Math.floor((Date.now() - targetMember.joinedTimestamp) / (1000 * 60 * 60 * 24));

    // Get user's permissions
    const keyPermissions = [];
    if (targetMember.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push("Administrator");
    if (targetMember.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push("Manage Server");
    if (targetMember.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push("Manage Channels");
    if (targetMember.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push("Manage Roles");
    if (targetMember.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push("Ban Members");
    if (targetMember.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push("Kick Members");

    // Get boost status
    const boostStatus = targetMember.premiumSince
      ? `✨ Boosting since <t:${Math.floor(targetMember.premiumSinceTimestamp / 1000)}:R>`
      : "Not boosting";

    // Get user status/activity
    const presence = targetMember.presence;
    const statusEmojis = {
      online: "🟢",
      idle: "🟡",
      dnd: "🔴",
      offline: "⚫"
    };
    const statusText = presence ? `${statusEmojis[presence.status] || "⚫"} ${presence.status.charAt(0).toUpperCase() + presence.status.slice(1)}` : "⚫ Offline";

    const embed = new EmbedBuilder()
      .setTitle(`User Information - ${targetUser.tag}`)
      .setColor(targetMember.displayHexColor || 0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "Username", value: targetUser.username, inline: true },
        { name: "Display Name", value: targetMember.displayName, inline: true },
        { name: "User ID", value: `\`${targetUser.id}\``, inline: true },
        { name: "Account Created", value: `<t:${accountCreated}:F>\n<t:${accountCreated}:R> (${accountAgeDays} days ago)`, inline: false },
        { name: "Joined Server", value: `<t:${joinedServer}:F>\n<t:${joinedServer}:R> (${serverAgeDays} days ago)`, inline: false },
        { name: "Boost Status", value: boostStatus, inline: false },
        { name: "Status", value: statusText, inline: true },
        { name: `Roles [${roles.length}]`, value: roles.length > 0 ? roles.join(", ") : "No roles", inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    // Add permissions if user has any key permissions
    if (keyPermissions.length > 0) {
      embed.addFields({
        name: "Key Permissions",
        value: keyPermissions.join(", "),
        inline: false
      });
    }

    // Add avatar link
    embed.addFields({
      name: "Avatar",
      value: `[View Full Size](${targetUser.displayAvatarURL({ dynamic: true, size: 4096 })})`,
      inline: false
    });

    return interaction.reply({ embeds: [embed] });
  }

  // ============== OWNER/COOWNER COMMANDS ==============
  if (!isOwnerOrCoowner(member, config)) {
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("❌ You don't have permission to use this command!")
        .setColor(0xED4245),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (name === "verifyembed") {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    return createVerificationPanel(interaction, config, configPath);
  }

  // Role Management
  if (name === "addstaffrole") {
    const role = interaction.options.getRole("role", true);
    const set = new Set(config.staff_role_ids || []);
    set.add(role.id);
    config.staff_role_ids = Array.from(set);
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Added staff role: ${role}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "removestaffrole") {
    const role = interaction.options.getRole("role", true);
    const set = new Set(config.staff_role_ids || []);
    if (set.delete(role.id)) {
      config.staff_role_ids = Array.from(set);
      saveJson(configPath, config);
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ Removed staff role: ${role}`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    } else {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("❌ That role is not in the staff list!")
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  if (name === "setboosterrole") {
    const role = interaction.options.getRole("role", true);
    config.booster_role_id = role.id;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Booster role set to: ${role}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "addownerrole") {
    const role = interaction.options.getRole("role", true);
    const set = new Set(config.owner_role_ids || []);
    set.add(role.id);
    config.owner_role_ids = Array.from(set);
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Added owner role: ${role}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "addcoownerrole") {
    const role = interaction.options.getRole("role", true);
    const set = new Set(config.coowner_role_ids || []);
    set.add(role.id);
    config.coowner_role_ids = Array.from(set);
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Added co-owner role: ${role}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  // Staff Reports
  if (name === "staffreport") {
    return showStaffReport(interaction, data, config);
  }

  if (name === "staffstats") {
    return showStaffStats(interaction, data, config);
  }

  // Boost Management
  if (name === "boostreport") {
    return showBoostReport(interaction, data);
  }

  if (name === "boostlog") {
    return showBoostLog(interaction, data);
  }

  if (name === "boosts") {
    return showCurrentBoosters(interaction, config, data);
  }

  // Ticket Setup - All-in-one configuration command
  if (name === "ticketsetup") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "channels") {
      const category = interaction.options.getChannel("category", true);
      const logChannel = interaction.options.getChannel("logchannel", true);

      // Validate that category is actually a category
      const { ChannelType } = require("discord.js");
      if (category.type !== ChannelType.GuildCategory) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`❌ ${category} is not a category! Please select an actual category channel (not a text/voice channel).`)
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      config.ticket_category_id = category.id;
      config.ticket_log_channel_id = logChannel.id;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Ticket Channels Configured")
          .addFields(
            { name: "Category", value: `${category}`, inline: true },
            { name: "Log Channel", value: `${logChannel}`, inline: true }
          )
          .setDescription("Use `/ticketsetup panel` to customize appearance.")
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "panel") {
      const panel = getPanelConfig(config);
      let updated = [];

      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const color = interaction.options.getString("color");
      const footer = interaction.options.getString("footer");
      const thumbnail = interaction.options.getString("thumbnail");

      if (title) {
        panel.title = title;
        updated.push("title");
      }
      if (description) {
        panel.description = description;
        updated.push("description");
      }
      if (color) {
        panel.color = parseInt(color.replace("#", ""), 16);
        updated.push("color");
      }
      if (footer) {
        panel.footer = footer;
        updated.push("footer");
      }
      if (thumbnail) {
        panel.thumbnail = thumbnail;
        updated.push("thumbnail");
      }

      if (updated.length === 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription("❌ Please provide at least one option to update!")
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      config.ticket_panel = panel;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ Panel updated: ${updated.join(", ")}!`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "addbutton") {
      const panel = getPanelConfig(config);
      const id = interaction.options.getString("id");
      const label = interaction.options.getString("label");
      const emoji = interaction.options.getString("emoji");
      const style = interaction.options.getString("style");
      const description = interaction.options.getString("description") || "";

      const buttonIndex = panel.buttons.findIndex(b => b.id === id);
      const buttonData = { id, label, emoji, style, description };

      if (buttonIndex >= 0) {
        panel.buttons[buttonIndex] = buttonData;
      } else {
        panel.buttons.push(buttonData);
      }

      config.ticket_panel = panel;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle(`Button ${buttonIndex >= 0 ? 'Updated' : 'Added'}`)
          .setDescription(
            `ID: \`${id}\`\n` +
            `Label: ${label}\n` +
            `Emoji: ${emoji}\n` +
            `Style: ${style}\n` +
            `Description: ${description || "None"}\n\n` +
            `Total buttons: ${panel.buttons.length}`
          )
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "removebutton") {
      const panel = getPanelConfig(config);
      const id = interaction.options.getString("id");

      const buttonIndex = panel.buttons.findIndex(b => b.id === id);

      if (buttonIndex === -1) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`❌ Button with ID \`${id}\` not found!`)
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const removedButton = panel.buttons[buttonIndex];
      panel.buttons.splice(buttonIndex, 1);

      config.ticket_panel = panel;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ Removed button "${removedButton.label}" (ID: \`${id}\`)`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "listbuttons") {
      const panel = getPanelConfig(config);

      if (panel.buttons.length === 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription("❌ No buttons configured! Use `/ticketsetup addbutton` to add one.")
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const buttonList = panel.buttons.map((btn, i) =>
        `${i + 1}. ${btn.emoji} ${btn.label}\n` +
        `   ID: \`${btn.id}\` | Style: ${btn.style}` +
        (btn.description ? `\n   ${btn.description}` : "")
      ).join("\n\n");

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Ticket Buttons")
          .setDescription(buttonList)
          .setFooter({ text: `Total: ${panel.buttons.length}` })
          .setColor(0x5865F2),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "reorderbuttons") {
      const panel = getPanelConfig(config);
      const orderString = interaction.options.getString("order", true);
      const newOrder = orderString.split(",").map(id => id.trim());

      // Validate all IDs exist
      const existingIds = panel.buttons.map(b => b.id);
      const invalidIds = newOrder.filter(id => !existingIds.includes(id));
      const missingIds = existingIds.filter(id => !newOrder.includes(id));

      if (invalidIds.length > 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`❌ Unknown button IDs: ${invalidIds.join(", ")}`)
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (missingIds.length > 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`❌ Missing button IDs in order: ${missingIds.join(", ")}`)
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Reorder buttons
      const reorderedButtons = newOrder.map(id => panel.buttons.find(b => b.id === id));
      panel.buttons = reorderedButtons;
      config.ticket_panel = panel;
      saveJson(configPath, config);

      const buttonList = panel.buttons.map((btn, i) => `${i + 1}. ${btn.emoji} ${btn.label} (${btn.id})`).join("\n");

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Buttons Reordered")
          .setDescription(`New order:\n${buttonList}`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "reset") {
      config.ticket_panel = JSON.parse(JSON.stringify(DEFAULT_PANEL));
      saveJson(configPath, config);
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("✅ Ticket panel reset to default settings!")
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }
  }

  if (name === "ticketpanel") {
    return createTicketPanel(interaction, config, configPath);
  }

  // Roles Panel
  if (name === "rolespanel") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "configure") {
      const roleType = interaction.options.getString("id", true);
      const role = interaction.options.getRole("role", true);

      const panel = getRolesPanelConfig(config);
      const roleConfig = panel.roles.find(r => r.id === roleType);

      if (roleConfig) {
        roleConfig.role_id = role.id;
        config.roles_panel = panel;
        saveJson(configPath, config);

        const embed = addLogo(
          new EmbedBuilder()
            .setDescription(`✅ Configured ${roleConfig.label} → ${role}`)
            .setColor(0x57F287),
          config
        );
        return interaction.reply({ embeds: [embed] });
      }
    }

    if (subcommand === "customize") {
      const panel = getRolesPanelConfig(config);
      let updated = [];

      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const color = interaction.options.getString("color");

      if (title) {
        panel.title = title;
        updated.push("title");
      }
      if (description) {
        panel.description = description;
        updated.push("description");
      }
      if (color) {
        panel.color = parseInt(color.replace("#", ""), 16);
        updated.push("color");
      }

      if (updated.length === 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription("❌ Please provide at least one option to update!")
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      config.roles_panel = panel;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ Panel updated: ${updated.join(", ")}!`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "post") {
      return createRolesPanel(interaction, config, configPath);
    }
  }

  // Movie Night
  if (name === "movie") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "announce") {
      return announceMovie(interaction, config, data, dataPath, io);
    }
    if (subcommand === "schedule") {
      return addToSchedule(interaction, data, dataPath, io);
    }
    if (subcommand === "upcoming") {
      return showSchedule(interaction, data);
    }
    if (subcommand === "remove") {
      return removeFromSchedule(interaction, data, dataPath, io);
    }
    if (subcommand === "poll") {
      return createMoviePoll(interaction, data, dataPath);
    }
    if (subcommand === "volume") {
      return showVolumeHelp(interaction);
    }
    if (subcommand === "stats") {
      return showStats(interaction, data);
    }
  }

  // Set Event Live
  if (name === "seteventlive") {
    return setEventLive(interaction, data, dataPath, io);
  }

  // Giveaway System
  if (name === "giveaway") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "start") {
      return startGiveaway(interaction, data, dataPath);
    }
    if (subcommand === "end") {
      return endGiveaway(interaction, data, dataPath);
    }
    if (subcommand === "reroll") {
      return rerollGiveaway(interaction, data, dataPath);
    }
    if (subcommand === "list") {
      return listGiveaways(interaction, data);
    }
  }

  // Help Command
  if (name === "help") {
    const embed = new EmbedBuilder()
      .setTitle("Lurked Accounts Bot")
      .setDescription("Complete server management with tickets, verification, moderation, and more.")
      .setColor(0x5865F2)
      .addFields(
        {
          name: "🎫 Support Tickets",
          value:
            "`/ticketpanel` - Post ticket panel\n" +
            "`/ticketsetup` - Configure system\n" +
            "`/ticketpriority` - Set priority\n" +
            "`/ticketnote` `/ticketnotes` - Staff notes\n" +
            "`/ticketadd` `/ticketremove` - Manage users\n" +
            "`/ticketstats` - View statistics",
          inline: true
        },
        {
          name: "✅ Verification",
          value:
            "`/verifypanel` - Post verify panel\n" +
            "`/verify user` - Manual verify\n" +
            "`/verify unverify` - Remove verify\n" +
            "`/verify stats` - View stats\n" +
            "`/verify config` - Settings\n" +
            "**Method:** Math CAPTCHA",
          inline: true
        },
        {
          name: "🛡️ Moderation",
          value:
            "`/purge` - Bulk delete\n" +
            "`/timeout` `/untimeout` - Mute\n" +
            "`/kick` `/ban` `/unban`\n" +
            "`/softban` - Kick + delete\n" +
            "`/userinfo` - User info",
          inline: true
        },
        {
          name: "🤖 Auto-Moderation",
          value:
            "`/automod enable/disable`\n" +
            "`/automod status` - View config\n" +
            "`/automod spam/links/badwords`\n" +
            "`/automod immune` - Exempt roles\n" +
            "**Action:** Auto-delete",
          inline: true
        },
        {
          name: "👥 Staff & Boosts",
          value:
            "`/staffreport` - Team overview\n" +
            "`/staffstats` - Individual stats\n" +
            "`/boostreport` - Boost analytics\n" +
            "`/currentboosters` - Active list",
          inline: true
        },
        {
          name: "🎁 Giveaways",
          value:
            "`/giveaway start` - Create\n" +
            "`/giveaway end` - End early\n" +
            "`/giveaway reroll` - New winner\n" +
            "`/giveaway list` - View active",
          inline: true
        },
        {
          name: "🎬 Movie Night",
          value:
            "`/movie announce` - RSVP event\n" +
            "`/movie schedule` - Add to queue\n" +
            "`/movie poll` - Vote on movies\n" +
            "`/movie stats` - View stats",
          inline: true
        },
        {
          name: "🎭 Roles Panel",
          value:
            "`/rolespanel configure` - Setup\n" +
            "`/rolespanel post` - Post panel\n" +
            "`/rolespanel customize` - Style",
          inline: true
        },
        {
          name: "📊 Polls & Welcome",
          value:
            "`/poll` - Create poll\n" +
            "`/setwelcome` `/setleave`\n" +
            "`/disablewelcome` `/disableleave`",
          inline: true
        },
        {
          name: "📝 Embed Creator",
          value:
            "`/embed create` - Basic embed\n" +
            "`/embed advanced` - With fields\n" +
            "**Features:** Color, footer, images",
          inline: true
        },
        {
          name: "📋 Audit Logging",
          value:
            "`/setlogchannel` - Set log channel\n" +
            "`/logs view` - View log settings\n" +
            "`/logs config` - Configure logs\n" +
            "`/disablelogs` - Disable logging",
          inline: true
        },
        {
          name: "⚙️ Configuration",
          value:
            "`/quicksetup tickets` - Fast setup\n" +
            "`/quicksetup staff` - Staff setup\n" +
            "`/setlogo` - Bot logo\n" +
            "`/security dashboard` - Security",
          inline: true
        }
      )
      .setFooter({ text: "Use /quicksetup for fast configuration | Admin commands require permissions" })
      .setTimestamp();

    if (config.logo_url) embed.setThumbnail(config.logo_url);

    return interaction.reply({ embeds: [embed] });
  }

  // Moderation
  if (name === "nuke") {
    return nukeMessages(interaction, config);
  }

  if (name === "timeout") {
    return timeoutUser(interaction, config);
  }

  if (name === "untimeout") {
    return untimeoutUser(interaction, config);
  }

  if (name === "kick") {
    return kickUser(interaction, config);
  }

  if (name === "ban") {
    return banUser(interaction, config);
  }

  if (name === "softban") {
    return softbanUser(interaction, config);
  }

  if (name === "unban") {
    return unbanUser(interaction, config);
  }

  // Poll System
  if (name === "poll") {
    return createPoll(interaction, data, dataPath);
  }

  // Welcome/Leave Messages
  if (name === "setwelcome") {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message");
    config.welcome_channel_id = channel.id;
    if (message) config.welcome_message = message;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Welcome messages enabled in ${channel}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "setleave") {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message");
    config.leave_channel_id = channel.id;
    if (message) config.leave_message = message;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Leave messages enabled in ${channel}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "disablewelcome") {
    delete config.welcome_channel_id;
    delete config.welcome_message;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("✅ Welcome messages disabled")
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "disableleave") {
    delete config.leave_channel_id;
    delete config.leave_message;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("✅ Leave messages disabled")
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  // Audit Logging
  if (name === "setlogchannel") {
    const channel = interaction.options.getChannel("channel", true);
    config.audit_log_channel_id = channel.id;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`✅ Audit logs will be sent to ${channel}`)
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "verifylog") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const channel = interaction.options.getChannel("channel", true);
      config.verify_log_channel_id = channel.id;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`Verification logs will be sent to ${channel}`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }
  }

  if (name === "disablelogs") {
    delete config.audit_log_channel_id;
    saveJson(configPath, config);

    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("✅ Audit logging disabled")
        .setColor(0x57F287),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  // Log Configuration
  if (name === "logs") {
    const subcommand = interaction.options.getSubcommand();

    // Initialize logging config if it doesn't exist
    if (!config.logging) {
      config.logging = {
        moderation: true,
        member_events: true,
        role_updates: true,
        message_delete: true,
        message_edit: true,
        message_bulk_delete: true
      };
    }

    if (subcommand === "view") {
      const logChannel = config.audit_log_channel_id
        ? `<#${config.audit_log_channel_id}>`
        : "Not set";

      const getStatus = (enabled) => (enabled !== false ? "🟢 Enabled" : "🔴 Disabled");

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle("Logging Configuration")
          .setDescription(`**Log Channel:** ${logChannel}\n\nUse \`/logs config\` to toggle individual log types.`)
          .addFields(
            { name: "🔨 Moderation", value: getStatus(config.logging.moderation), inline: true },
            { name: "👥 Member Events", value: getStatus(config.logging.member_events), inline: true },
            { name: "🎭 Role Updates", value: getStatus(config.logging.role_updates), inline: true },
            { name: "🗑️ Message Delete", value: getStatus(config.logging.message_delete), inline: true },
            { name: "✏️ Message Edit", value: getStatus(config.logging.message_edit), inline: true },
            { name: "🧹 Bulk Delete", value: getStatus(config.logging.message_bulk_delete), inline: true }
          )
          .setColor(0x5865F2)
          .setFooter({ text: "All logs require a log channel to be set with /setlogchannel" }),
        config
      );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === "config") {
      const type = interaction.options.getString("type");
      const enabled = interaction.options.getBoolean("enabled");

      if (!type && enabled === null) {
        // Show current config
        const getStatus = (enabled) => (enabled !== false ? "🟢 Enabled" : "🔴 Disabled");

        const embed = addLogo(
          new EmbedBuilder()
            .setTitle("Logging Configuration")
            .setDescription("Configure which events are logged to your audit log channel.")
            .addFields(
              { name: "🔨 Moderation", value: getStatus(config.logging.moderation), inline: true },
              { name: "👥 Member Events", value: getStatus(config.logging.member_events), inline: true },
              { name: "🎭 Role Updates", value: getStatus(config.logging.role_updates), inline: true },
              { name: "🗑️ Message Delete", value: getStatus(config.logging.message_delete), inline: true },
              { name: "✏️ Message Edit", value: getStatus(config.logging.message_edit), inline: true },
              { name: "🧹 Bulk Delete", value: getStatus(config.logging.message_bulk_delete), inline: true }
            )
            .setColor(0x5865F2)
            .setFooter({ text: "Use /logs config type:<type> enabled:<true/false> to change" }),
          config
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!type || enabled === null) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription("❌ You must specify both `type` and `enabled` options!")
            .setColor(0xED4245),
          config
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      config.logging[type] = enabled;
      saveJson(configPath, config);

      const typeNames = {
        moderation: "Moderation",
        member_events: "Member Events",
        role_updates: "Role Updates",
        message_delete: "Message Delete",
        message_edit: "Message Edit",
        message_bulk_delete: "Bulk Delete"
      };

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ ${typeNames[type]} logging ${enabled ? "enabled" : "disabled"}`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "enableall") {
      config.logging = {
        moderation: true,
        member_events: true,
        role_updates: true,
        message_delete: true,
        message_edit: true,
        message_bulk_delete: true
      };
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("✅ All log types have been enabled!")
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "disableall") {
      config.logging = {
        moderation: false,
        member_events: true, // Keep member events enabled by default
        role_updates: false,
        message_delete: false,
        message_edit: false,
        message_bulk_delete: false
      };
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("✅ All log types disabled (except member events)")
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }
  }

  // Auto-Moderation
  if (name === "automod") {
    return configureAutomod(interaction, config, configPath);
  }

  // Ticket Enhancements
  if (name === "ticketpriority") {
    return setTicketPriority(interaction, data, dataPath);
  }

  if (name === "ticketnote") {
    return addTicketNote(interaction, data, dataPath);
  }

  if (name === "ticketnotes") {
    return viewTicketNotes(interaction, data);
  }

  if (name === "ticketstats") {
    return viewTicketStats(interaction, data, config);
  }

  if (name === "ticketautoclose") {
    return toggleAutoClose(interaction, config, configPath);
  }

  if (name === "ticketrename") {
    return renameTicket(interaction, data, dataPath);
  }

  if (name === "setratingschannel") {
    return setRatingsChannel(interaction, config, configPath);
  }

  if (name === "ticketadd") {
    return addUserToTicket(interaction, data, dataPath, config);
  }

  if (name === "ticketremove") {
    return removeUserFromTicket(interaction, data, dataPath, config);
  }

  if (name === "ticketparticipants") {
    return listTicketParticipants(interaction, data, dataPath);
  }


  // ============== VERIFICATION SYSTEM ==============
  if (name === "verifypanel") {
    return createVerificationPanel(interaction, config);
  }

  if (name === "verify") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "user") {
      return manualVerify(interaction, config, data, dataPath);
    }

    if (subcommand === "unverify") {
      return unverifyUser(interaction, config, data, dataPath);
    }

    if (subcommand === "stats") {
      return showVerificationStats(interaction, data, config);
    }

    if (subcommand === "config") {
      return configureVerification(interaction, config, configPath);
    }

    if (subcommand === "setchannel") {
      return setVerificationChannel(interaction, config, configPath);
    }
  }

  // ============== ROLE MANAGEMENT ==============
  if (name === "addrole") {
    const targetUser = interaction.options.getUser("user", true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("❌ User not found in this server!")
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Collect all roles to add
    const rolesToAdd = [];
    const role1 = interaction.options.getRole("role", true);
    rolesToAdd.push(role1);

    for (let i = 2; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) rolesToAdd.push(role);
    }

    // Check if bot can manage these roles
    const botMember = interaction.guild.members.me;
    const unmanageable = rolesToAdd.filter(role => role.position >= botMember.roles.highest.position);
    if (unmanageable.length > 0) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`❌ I can't manage these roles (they're higher than my highest role):\n${unmanageable.map(r => r.toString()).join(", ")}`)
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Check if user can manage these roles
    const userUnmanageable = rolesToAdd.filter(role => role.position >= member.roles.highest.position && !member.permissions.has(PermissionFlagsBits.Administrator));
    if (userUnmanageable.length > 0) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`❌ You can't manage these roles (they're higher than your highest role):\n${userUnmanageable.map(r => r.toString()).join(", ")}`)
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Add the roles
    const added = [];
    const alreadyHad = [];
    const failed = [];

    for (const role of rolesToAdd) {
      if (targetMember.roles.cache.has(role.id)) {
        alreadyHad.push(role);
      } else {
        try {
          await targetMember.roles.add(role);
          added.push(role);
        } catch (err) {
          failed.push(role);
        }
      }
    }

    let description = "";
    if (added.length > 0) {
      description += `✅ Added: ${added.map(r => r.toString()).join(", ")}\n`;
    }
    if (alreadyHad.length > 0) {
      description += `ℹ️ Already had: ${alreadyHad.map(r => r.toString()).join(", ")}\n`;
    }
    if (failed.length > 0) {
      description += `❌ Failed: ${failed.map(r => r.toString()).join(", ")}\n`;
    }

    const embed = addLogo(
      new EmbedBuilder()
        .setTitle(`Roles Updated - ${targetUser.tag}`)
        .setDescription(description)
        .setColor(added.length > 0 ? 0x57F287 : 0xFEE75C),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  if (name === "removerole") {
    const targetUser = interaction.options.getUser("user", true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription("❌ User not found in this server!")
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Collect all roles to remove
    const rolesToRemove = [];
    const role1 = interaction.options.getRole("role", true);
    rolesToRemove.push(role1);

    for (let i = 2; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) rolesToRemove.push(role);
    }

    // Check if bot can manage these roles
    const botMember = interaction.guild.members.me;
    const unmanageable = rolesToRemove.filter(role => role.position >= botMember.roles.highest.position);
    if (unmanageable.length > 0) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`❌ I can't manage these roles (they're higher than my highest role):\n${unmanageable.map(r => r.toString()).join(", ")}`)
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Check if user can manage these roles
    const userUnmanageable = rolesToRemove.filter(role => role.position >= member.roles.highest.position && !member.permissions.has(PermissionFlagsBits.Administrator));
    if (userUnmanageable.length > 0) {
      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`❌ You can't manage these roles (they're higher than your highest role):\n${userUnmanageable.map(r => r.toString()).join(", ")}`)
          .setColor(0xED4245),
        config
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Remove the roles
    const removed = [];
    const didntHave = [];
    const failed = [];

    for (const role of rolesToRemove) {
      if (!targetMember.roles.cache.has(role.id)) {
        didntHave.push(role);
      } else {
        try {
          await targetMember.roles.remove(role);
          removed.push(role);
        } catch (err) {
          failed.push(role);
        }
      }
    }

    let description = "";
    if (removed.length > 0) {
      description += `✅ Removed: ${removed.map(r => r.toString()).join(", ")}\n`;
    }
    if (didntHave.length > 0) {
      description += `ℹ️ Didn't have: ${didntHave.map(r => r.toString()).join(", ")}\n`;
    }
    if (failed.length > 0) {
      description += `❌ Failed: ${failed.map(r => r.toString()).join(", ")}\n`;
    }

    const embed = addLogo(
      new EmbedBuilder()
        .setTitle(`Roles Updated - ${targetUser.tag}`)
        .setDescription(description)
        .setColor(removed.length > 0 ? 0x57F287 : 0xFEE75C),
      config
    );
    return interaction.reply({ embeds: [embed] });
  }

  // ============== SECURITY DASHBOARD ==============
  if (name === "security") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "dashboard") {
      return showSecurityDashboard(interaction, data, config);
    }

    if (subcommand === "logs") {
      const alertsOnly = interaction.options.getBoolean("alerts_only") || false;
      // For direct command, we reply, for button we update
      if (!data.security_logs || data.security_logs.length === 0) {
        const embed = addLogo(
          new EmbedBuilder()
            .setDescription("No security logs found")
            .setColor(0x5865f2),
          config
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const logs = data.security_logs || [];
      let filtered = logs;
      if (alertsOnly) {
        filtered = logs.filter(l => l.severity === "alert" || l.severity === "critical");
      }

      const recent = filtered.slice(-15).reverse();
      const formatLog = (log) => {
        const time = `<t:${Math.floor(new Date(log.timestamp).getTime() / 1000)}:R>`;
        const user = log.user_tag ? `**${log.user_tag}**` : "Unknown";
        const severityEmoji = log.severity === "critical" ? "🔴" : log.severity === "alert" ? "🟠" : log.severity === "warning" ? "🟡" : "⚪";

        const typeLabels = {
          verify_success: "Verified",
          verify_fail: "Verify Failed",
          verify_timeout: "Verify Timeout",
          account_too_new: "Account Too New",
          alt_detected: "Alt Detected",
          suspicious_join: "Suspicious Join",
          rapid_rejoin: "Rapid Rejoin",
          member_join: "Joined",
          member_leave: "Left",
          member_kicked: "Kicked",
          member_banned: "Banned",
          manual_verify: "Manual Verify",
          manual_unverify: "Manual Unverify",
        };

        const label = typeLabels[log.type] || log.type;
        return `${severityEmoji} ${time} - ${user} - ${label}`;
      };

      const logText = recent.map(formatLog).join("\n");

      const embed = addLogo(
        new EmbedBuilder()
          .setTitle(alertsOnly ? "Security Alerts" : "Recent Security Logs")
          .setDescription(logText.substring(0, 4000) || "No logs found")
          .setColor(alertsOnly ? 0xED4245 : 0x5865f2)
          .setFooter({ text: `Showing ${recent.length} of ${filtered.length} logs` })
          .setTimestamp(),
        config
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === "setchannel") {
      const channel = interaction.options.getChannel("channel", true);
      config.security_log_channel_id = channel.id;
      saveJson(configPath, config);

      const embed = addLogo(
        new EmbedBuilder()
          .setDescription(`✅ Security logs will be sent to ${channel}`)
          .setColor(0x57F287),
        config
      );
      return interaction.reply({ embeds: [embed] });
    }
  }

  // ============== EMBED CREATOR ==============
  if (name === "embed") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      return showEmbedModal(interaction);
    }

    if (subcommand === "advanced") {
      return showAdvancedEmbedModal(interaction);
    }
  }

}

module.exports = { handleInteraction };

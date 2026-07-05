const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");
const { hasStaffRole, isOwnerOrCoowner } = require("../utils/permissions");
const EMOJIS = require("../utils/emojis");

const TICKET_EMOJI = EMOJIS.ticket;
const TICKET_WARNING_TEXT =
  `${EMOJIS.warning} Pinging staff results in a warning, and can result in a ban by staff if excessive or asked not to.\n` +
  `${EMOJIS.announcement} tickets auto close after 24 hours if no activity`;
const CLOSE_REQUEST_AUTO_CLOSE_MS = 5 * 60 * 1000;
const closeRequestTimers = new Map();

// Default ticket panel configuration
const DEFAULT_PANEL = {
  title: "Support Tickets",
  description:
    "**__Ticket Rules:__**\n" +
    "**1.** By opening a ticket, you automatically agree to our __Terms of Service__.\n" +
    "**2.** When starting a ticket, please avoid unnecessary messages — see __[nohello.net](https://nohello.net)__ for proper etiquette.\n" +
    "**3.** Be __clear__ and __concise__ when describing your issue. This helps us assist you ***faster***.\n\n" +
    "**__Support Hours:__**\n" +
    "**Standard Hours:** 11:00 AM – 8:00 PM EST\n" +
    "*We strive to be available outside these hours, but replies may take longer.*\n\n" +
    "─────────────────────────────────────\n" +
    "**Select a category** from the dropdown below to open a ticket.",
  color: 0x522081,
  footer: "© Lurked. All Rights Reserved.",
  thumbnail: null,
  image: null,
  buttons: [
    {
      id: "general",
      label: "General Support",
      emoji: TICKET_EMOJI,
      style: "Primary",
      description: "Open a ticket for general support."
    },
    {
      id: "bug",
      label: "Bug Report",
      emoji: "🐛",
      style: "Danger",
      description: "Report a bug or technical issue."
    },
    {
      id: "account",
      label: "Purchase Inquiry",
      emoji: "🛒",
      style: "Success",
      description: "Open to make a purchase inquiry."
    },
    {
      id: "other",
      label: "Other",
      emoji: "📁",
      style: "Secondary",
      description: "Anything else not listed above."
    }
  ]
};

function canManageTickets(member, config) {
  if (!member) return false;
  return (
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    hasStaffRole(member, config) ||
    isOwnerOrCoowner(member, config)
  );
}

function normalizeTicketPanelEmojis(panel) {
  const defaults = {
    general: EMOJIS.ticket,
    bug: EMOJIS.report,
    account: EMOJIS.unlock,
    other: EMOJIS.lurk,
  };

  for (const button of panel.buttons || []) {
    if (defaults[button.id]) {
      button.emoji = defaults[button.id];
    }
  }
}

function buildTicketPanelDescription() {
  return [
    `${EMOJIS.ticket} **__Welcome to LurkedAccounts Support__**`,
    "",
    "We aim to keep support **clear**, **quick**, and **organized** while helping the community as smoothly as possible.",
    "",
    `${EMOJIS.pin} **To get started:**`,
    "> **1.** Select the category that best matches your issue.",
    "> **2.** Explain what you need in your first message.",
    "> **3.** Include screenshots, usernames, order details, or error messages when useful.",
    "",
    `${EMOJIS.discordDeveloper} **Website:** [Open LurkedAccounts](https://lurkedaccounts.netlify.app/)`,
    "`https://lurkedaccounts.netlify.app/`",
  ].join("\n");
}

function buildTicketCategoryList(panel) {
  return (panel.buttons || [])
    .map((button) => `${button.emoji || EMOJIS.ticket} **${button.label}** - ${button.description || "Open a support ticket."}`)
    .join("\n");
}

function clearCloseRequestTimer(channelId) {
  const timer = closeRequestTimers.get(channelId);
  if (timer) {
    clearTimeout(timer);
    closeRequestTimers.delete(channelId);
  }
}

function scheduleCloseRequestAutoClose(channel, requestedBy, config, data, dataPath) {
  clearCloseRequestTimer(channel.id);

  const timer = setTimeout(async () => {
    closeRequestTimers.delete(channel.id);
    const ticket = data.tickets?.[channel.id];
    if (!ticket || ticket.closed) return;

    const autoEmbed = new EmbedBuilder()
      .setTitle("Ticket Auto-Closing")
      .setDescription(
        `${EMOJIS.warning} **__Five minutes have passed since the close request.__**\n\n` +
        `No additional time was requested, so this ticket is now closing on behalf of ${requestedBy}.\n\n` +
        "> A transcript will be generated, staff logs will be saved, and the ticket creator can open a new ticket anytime."
      )
      .setColor(0x522081)
      .setFooter({ text: "Thank you for contacting support" })
      .setTimestamp();

    addLogo(autoEmbed, config);
    await channel.send({ embeds: [autoEmbed] }).catch(() => {});
    await closeTicket(channel, requestedBy, config, data, dataPath);
  }, CLOSE_REQUEST_AUTO_CLOSE_MS);

  closeRequestTimers.set(channel.id, timer);
}

// Get panel config or create default
function getPanelConfig(config) {
  if (!config.ticket_panel) {
    config.ticket_panel = DEFAULT_PANEL;
  }
  normalizeTicketPanelEmojis(config.ticket_panel);
  return config.ticket_panel;
}

// Create ticket panel embed
async function createTicketPanel(interaction, config, configPath) {
  const panel = getPanelConfig(config);
  saveJson(configPath, config);

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(buildTicketPanelDescription())
    .addFields(
      {
        name: `${EMOJIS.report} __Support Categories__`,
        value: buildTicketCategoryList(panel) || `${EMOJIS.ticket} **General Support** - Open a ticket for general support.`,
        inline: false
      },
      {
        name: `${EMOJIS.warning} __Before Opening A Ticket__`,
        value:
          "> **Do not ping staff.** Pinging staff results in a warning and can result in a ban if excessive or if staff ask you to stop.\n" +
          `> ${EMOJIS.announcement} Tickets auto close after **24 hours** with no activity.`,
        inline: false
      },
      {
        name: `${EMOJIS.check} __After Your Ticket Opens__`,
        value:
          "A staff member will review your inquiry, claim the ticket when available, and do their best to resolve the issue with you.",
        inline: false
      }
    )
    .setColor(panel.color)
    .setFooter({ text: panel.footer });

  if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
  if (panel.image) embed.setImage(panel.image);
  addLogo(embed, config);

  // Create dropdown select menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category_select")
    .setPlaceholder("Select a category...")
    .addOptions(
      panel.buttons.map(btn =>
        new StringSelectMenuOptionBuilder()
          .setLabel(btn.label)
          .setValue(btn.id)
          .setDescription(btn.description)
          .setEmoji(btn.emoji)
      )
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });

  const successEmbed = new EmbedBuilder()
    .setDescription("✅ Ticket panel created successfully!")
    .setColor(0x57F287);

  await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
}

// Create ticket from button
async function createTicketFromButton(interaction, category, config, data, dataPath) {
  if (!config.ticket_category_id) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Ticket system is not configured! Ask an admin to run `/ticketsetup` first.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (!data.tickets) {
    data.tickets = {};
  }

  // Check if user already has an open ticket
  const existingTicket = Object.values(data.tickets || {}).find(
    t => t.user_id === interaction.user.id && !t.closed
  );

  if (existingTicket) {
    const channelId = Object.keys(data.tickets).find(
      k => data.tickets[k].user_id === interaction.user.id && !data.tickets[k].closed
    );
    const embed = new EmbedBuilder()
      .setDescription(`❌ You already have an open ticket: <#${channelId}>`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Validate category exists and is actually a category
  const ticketCategory = interaction.guild.channels.cache.get(config.ticket_category_id);

  if (!ticketCategory) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Ticket category not found! Please run `/ticketsetup channels` again with a valid category.")
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }

  if (ticketCategory.type !== ChannelType.GuildCategory) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ The configured channel ${ticketCategory} is not a category! Please run \`/ticketsetup channels\` with an actual category channel.`)
      .setColor(0xED4245);
    return interaction.editReply({ embeds: [embed] });
  }

  data.ticket_counter = (data.ticket_counter || 0) + 1;
  const ticketNum = data.ticket_counter;

  // Create username-based channel name (sanitized)
  const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const channelName = `ticket-${username}-${String(ticketNum).padStart(4, '0')}`;

  try {
    // Build permission overwrites
    const permissionOverwrites = [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // Add staff roles - convert to string and verify they exist
    for (const roleId of (config.staff_role_ids || [])) {
      const role = interaction.guild.roles.cache.get(String(roleId));
      if (role) {
        permissionOverwrites.push({
          id: String(roleId),
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }
    }

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategory?.id,
      permissionOverwrites,
      topic: `Ticket #${ticketNum} | User: ${interaction.user.tag} | Category: ${category}`,
    });

    data.tickets[channel.id] = {
      ticket_num: ticketNum,
      user_id: interaction.user.id,
      user_tag: interaction.user.tag,
      category: category,
      created_at: new Date().toISOString(),
      claimed_by: null,
      closed: false,
      messages: [],
    };
    saveJson(dataPath, data);

    // Get button config for category name
    const panel = getPanelConfig(config);
    const buttonConfig = panel.buttons.find(b => b.id === category);
    const categoryName = buttonConfig ? buttonConfig.label : category;

    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${String(ticketNum).padStart(4, '0')}`)
      .setDescription(`${interaction.user} - A staff member will assist you shortly. Please describe your issue below.`)
      .addFields(
        { name: "Category", value: categoryName, inline: true },
        { name: "Opened", value: `<t:${Math.floor(Date.parse(data.tickets[channel.id].created_at) / 1000)}:R>`, inline: true },
        { name: "User", value: `${interaction.user.tag}`, inline: true },
        { name: "Warnings", value: TICKET_WARNING_TEXT, inline: false }
      )
      .setColor(0x522081)
      .setFooter({ text: "Use the buttons below to manage this ticket" })
      .setTimestamp();

    addLogo(embed, config);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(TICKET_EMOJI),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.no)
    );

    // Ping staff roles
    const staffPings = (config.staff_role_ids || [])
      .map(id => `<@&${id}>`)
      .join(' ');

    await channel.send({
      content: `${interaction.user} ${staffPings}`.trim(),
      embeds: [embed],
      components: [row]
    });

    const successEmbed = new EmbedBuilder()
      .setDescription(`✅ Ticket created successfully! ${channel}`)
      .setColor(0x57F287);

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error("Error creating ticket:", error);
    const errorEmbed = new EmbedBuilder()
      .setDescription("❌ Failed to create ticket. Please contact an administrator.")
      .setColor(0xED4245);
    await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }
}

async function handleClaim(interaction, data, dataPath, config) {
  const ticket = data.tickets[interaction.channel.id];
  if (!ticket) return;

  if (!canManageTickets(interaction.member, config)) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Only admins or staff can claim tickets.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (ticket.claimed_by) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ This ticket is already claimed by <@${ticket.claimed_by}>!`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  ticket.claimed_by = interaction.user.id;
  ticket.claimed_at = new Date().toISOString();
  saveJson(dataPath, data);

  const embed = new EmbedBuilder()
    .setTitle("Ticket Claimed")
    .setDescription(`${interaction.user} has claimed this ticket and will be handling your inquiry. They will try their best to resolve any issues you may have.`)
    .addFields(
      { name: "Claimed By", value: `${interaction.user}`, inline: true },
      { name: "Claimed", value: `<t:${Math.floor(Date.parse(ticket.claimed_at) / 1000)}:R>`, inline: true }
    )
    .setColor(0x57F287)
    .setTimestamp();

  addLogo(embed, config);

  await interaction.reply({ embeds: [embed] });
}

async function handleCloseTicketCommand(interaction, config, data, dataPath) {
  if (!canManageTickets(interaction.member, config)) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Only admins or staff can close tickets with this command.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const ticket = data.tickets?.[interaction.channel.id];
  if (!ticket) {
    const embed = new EmbedBuilder()
      .setDescription("❌ This command can only be used inside an active ticket channel.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  return handleClose(interaction, config, data, dataPath);
}

async function handleClose(interaction, config, data, dataPath) {
  const ticket = data.tickets[interaction.channel.id];
  if (!ticket) return;

  if (!canManageTickets(interaction.member, config)) {
    const embed = new EmbedBuilder()
      .setDescription(`${EMOJIS.no} Only admins or staff can request ticket closure.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const ticketUsers = [
    `<@${ticket.user_id}>`,
    ...(ticket.added_users || []).map(userId => `<@${userId}>`)
  ];
  const handledBy = ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Not claimed yet";

  // Show confirmation dialog
  const confirmEmbed = new EmbedBuilder()
    .setTitle("Close Ticket Confirmation")
    .setDescription(
      "Are you sure you want to close this ticket?\n\n" +
      "This will:\n" +
      "• Delete the channel permanently\n" +
      "• Send a transcript to the ticket creator\n" +
      "• Log the ticket in the ticket log channel\n\n" +
      "This action cannot be undone."
    )
    .setColor(0x522081)
    .setFooter({ text: `Ticket #${ticket.ticket_num}` })
    .setTimestamp();

  confirmEmbed
    .setTitle("Ticket Close Request")
    .setDescription(
      `${EMOJIS.ticket} **A staff member is preparing to close this ticket.**\n\n` +
      "Before this closes, please send any final details, screenshots, or questions here. " +
      "If you need more help later, you can open a new ticket anytime."
    )
    .setFields(
      { name: "Requested By", value: `${interaction.user}`, inline: true },
      { name: "Ticket Creator", value: `<@${ticket.user_id}>`, inline: true },
      { name: "Handled By", value: handledBy, inline: true },
      { name: "Users In This Ticket", value: ticketUsers.join("\n"), inline: false },
      {
        name: "What Happens Next",
        value:
          `${EMOJIS.check} This channel will be closed and deleted.\n` +
          `${EMOJIS.save} A transcript will be saved and sent to the ticket creator when DMs allow it.\n` +
          `${EMOJIS.report} Staff will receive a log copy for records.\n` +
          `${EMOJIS.fire} You may receive a quick feedback survey after closure.`,
        inline: false
      },
      {
        name: "Need More Help Later?",
        value: "You are always welcome to open another ticket if you have additional questions or a new inquiry.",
        inline: false
      }
    )
    .setFooter({ text: `Ticket #${ticket.ticket_num} • Only ${interaction.user.tag} can confirm or cancel this request` });

  confirmEmbed
    .setDescription(
      `${EMOJIS.ticket} **__A staff member is preparing to close this ticket.__**\n\n` +
      `> **Requested by:** ${interaction.user}\n` +
      `> **Ticket:** \`#${String(ticket.ticket_num).padStart(4, "0")}\`\n\n` +
      "Please send any **final details**, screenshots, or questions here before the ticket closes. " +
      "*If you need more help later, you can open a new ticket anytime.*"
    )
    .setFields(
      { name: "Requested By", value: `${interaction.user}`, inline: true },
      { name: "Ticket Creator", value: `<@${ticket.user_id}>`, inline: true },
      { name: "Handled By", value: handledBy, inline: true },
      { name: `${EMOJIS.lurk} __Users In This Ticket__`, value: ticketUsers.join("\n"), inline: false },
      {
        name: `${EMOJIS.save} __What Happens Next__`,
        value:
          "> The channel will be closed and deleted.\n" +
          "> A transcript will be saved and sent to the ticket creator when DMs allow it.\n" +
          "> Staff will receive a log copy for records.\n" +
          "> You may receive a quick feedback survey after closure.",
        inline: false
      },
      {
        name: `${EMOJIS.check} __Need More Help Later?__`,
        value: "You are always welcome to open another ticket if you have additional questions or a new inquiry.",
        inline: false
      },
      {
        name: `${EMOJIS.warning} __Auto-Close Notice__`,
        value:
          `This ticket will auto close **5 minutes** from this request if ${interaction.user} does not confirm it first.\n` +
          "Use that time to send final messages or request additional time.",
        inline: false
      }
    )
    .setFooter({ text: `Ticket #${ticket.ticket_num} • Only ${interaction.user.tag} can confirm or cancel this request` });

  addLogo(confirmEmbed, config);

  const confirmRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_confirm_${interaction.user.id}`)
        .setLabel("Yes, Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.check),
      new ButtonBuilder()
        .setCustomId(`ticket_close_cancel_${interaction.user.id}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.no)
    );

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
  scheduleCloseRequestAutoClose(interaction.channel, interaction.user, config, data, dataPath);
}

// Handle close confirmation
async function handleCloseConfirm(interaction, config, data, dataPath) {
  const ticket = data.tickets[interaction.channel.id];
  if (!ticket) return;

  const requesterId = interaction.customId.split("_").pop();
  if (requesterId && requesterId !== interaction.user.id) {
    const embed = new EmbedBuilder()
      .setDescription(`${EMOJIS.no} Only the staff member who requested this close can use these buttons.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  clearCloseRequestTimer(interaction.channel.id);

  const embed = new EmbedBuilder()
    .setTitle("Ticket Closing")
    .setDescription("This ticket is being closed. Channel will be deleted in 5 seconds. Transcript will be sent to the ticket creator's DMs.")
    .setColor(0x522081)
    .setFooter({ text: "Thank you for contacting support" })
    .setTimestamp();

  embed.setDescription(
    `${EMOJIS.check} This ticket has been approved for closure by ${interaction.user}.\n\n` +
    "A transcript will be generated, logs will be saved for staff, and this channel will be deleted in **5 seconds**. " +
    "You can open another ticket anytime if you need more help."
  );
  addLogo(embed, config);

  await interaction.update({ embeds: [embed], components: [] });

  setTimeout(async () => {
    await closeTicket(interaction.channel, interaction.user, config, data, dataPath);
  }, 5000);
}

// Handle close cancellation
async function handleCloseCancel(interaction, config) {
  const requesterId = interaction.customId.split("_").pop();
  if (requesterId && requesterId !== interaction.user.id) {
    const embed = new EmbedBuilder()
      .setDescription(`${EMOJIS.no} Only the staff member who requested this close can use these buttons.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  clearCloseRequestTimer(interaction.channel.id);

  const cancelEmbed = new EmbedBuilder()
    .setDescription("❌ Ticket close cancelled.")
    .setColor(0x522081);

  cancelEmbed
    .setTitle("Ticket Close Cancelled")
    .setDescription(`${EMOJIS.no} ${interaction.user} cancelled this close request. This ticket will remain open.`);
  addLogo(cancelEmbed, config);

  await interaction.update({ embeds: [cancelEmbed], components: [] });
}

async function closeTicket(channel, closedBy, config, data, dataPath) {
  const ticket = data.tickets[channel.id];
  if (!ticket) return null;

  clearCloseRequestTimer(channel.id);

  ticket.closed = true;
  ticket.closed_by = closedBy.id;
  ticket.closed_at = new Date().toISOString();

  // Fetch recent messages for transcript (last 100 messages)
  let messages = [];
  try {
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    messages = Array.from(fetchedMessages.values()).reverse();
  } catch (error) {
    console.error("Error fetching messages for transcript:", error);
  }

  // Create detailed transcript
  const createdDate = new Date(ticket.created_at);
  const closedDate = new Date(ticket.closed_at);
  const duration = formatDuration(closedDate - createdDate);

  // Generate HTML transcript
  const { generateHTMLTranscript } = require("../utils/transcriptGenerator");
  const htmlTranscript = generateHTMLTranscript(ticket, messages, closedBy, config);
  const htmlBuffer = Buffer.from(htmlTranscript, "utf-8");
  const htmlFileName = `ticket-${ticket.user_tag.replace(/[^a-z0-9]/gi, '-')}-${String(ticket.ticket_num).padStart(4, '0')}.html`;

  // Also create text transcript as backup
  let transcript = `═══════════════════════════════════════════════════════\n`;
  transcript += `TICKET TRANSCRIPT #${String(ticket.ticket_num).padStart(4, '0')}\n`;
  transcript += `═══════════════════════════════════════════════════════\n\n`;
  transcript += `Ticket Information:\n`;
  transcript += `  Ticket #: ${ticket.ticket_num}\n`;
  transcript += `  Opened by: ${ticket.user_tag} (${ticket.user_id})\n`;
  transcript += `  Category: ${ticket.category}\n`;
  transcript += `  Created: ${createdDate.toLocaleString()}\n`;
  transcript += `  Closed: ${closedDate.toLocaleString()}\n`;
  transcript += `  Duration: ${duration}\n`;
  transcript += `  Claimed by: ${ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Unclaimed"}\n`;
  transcript += `  Closed by: ${closedBy.tag} (${closedBy.id})\n`;
  transcript += `  Total Messages: ${messages.length}\n\n`;
  transcript += `${"=".repeat(60)}\n\n`;

  // Add all messages
  for (const msg of messages) {
    const timestamp = msg.createdAt.toLocaleTimeString();
    const author = msg.author.tag;
    transcript += `[${timestamp}] ${author}:\n`;
    if (msg.content) transcript += `${msg.content}\n`;
    if (msg.attachments.size > 0) {
      transcript += `Attachments: ${msg.attachments.map(a => a.url).join(", ")}\n`;
    }
    transcript += `\n`;
  }

  transcript += `\n${"=".repeat(60)}\n`;
  transcript += `End of transcript\n`;

  const textBuffer = Buffer.from(transcript, "utf-8");
  const textFileName = `ticket-${ticket.user_tag.replace(/[^a-z0-9]/gi, '-')}-${String(ticket.ticket_num).padStart(4, '0')}.txt`;

  // Send to log channel
  if (config.ticket_log_channel_id) {
    const logChannel = channel.guild.channels.cache.get(config.ticket_log_channel_id);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`Ticket Closed - #${String(ticket.ticket_num).padStart(4, '0')}`)
        .setDescription(`**User:** ${ticket.user_tag}\n**Category:** ${ticket.category}`)
        .addFields(
          { name: "User", value: `<@${ticket.user_id}>`, inline: true },
          { name: "Duration", value: duration, inline: true },
          { name: "Messages", value: `${messages.length}`, inline: true },
          { name: "Handled By", value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Unclaimed", inline: true },
          { name: "Closed By", value: `${closedBy}`, inline: true },
          { name: "\u200b", value: "\u200b", inline: true },
          { name: "Opened", value: `<t:${Math.floor(createdDate / 1000)}:R>`, inline: true },
          { name: "Closed", value: `<t:${Math.floor(closedDate / 1000)}:R>`, inline: true },
          { name: "\u200b", value: "\u200b", inline: true }
        )
        .setColor(0x522081)
        .setFooter({ text: "HTML & TXT transcripts attached - Open .html in browser" })
        .setTimestamp();

      addLogo(embed, config);

      await logChannel.send({
        embeds: [embed],
        files: [
          { attachment: htmlBuffer, name: htmlFileName },
          { attachment: textBuffer, name: textFileName }
        ]
      });
    }
  }

  // Try to DM the user the transcript
  let user;
  try {
    user = await channel.client.users.fetch(ticket.user_id);
    const dmEmbed = new EmbedBuilder()
      .setTitle(`Ticket Closed - #${String(ticket.ticket_num).padStart(4, '0')}`)
      .setDescription(`Your ticket in **${channel.guild.name}** has been closed. Your transcript is attached below for your records.`)
      .addFields(
        { name: "Duration", value: duration, inline: true },
        { name: "Messages", value: `${messages.length}`, inline: true },
        { name: "Handled By", value: closedBy.tag, inline: false }
      )
      .setColor(0x57F287)
      .setFooter({ text: "Thank you for contacting support" })
      .setTimestamp();

    addLogo(dmEmbed, config);

    await user.send({
      embeds: [dmEmbed],
      files: [
        { attachment: htmlBuffer, name: htmlFileName },
        { attachment: textBuffer, name: textFileName }
      ]
    });
  } catch (error) {
    console.log(`Could not DM transcript to user ${ticket.user_id}:`, error.message);
  }

  // Store closed ticket in history for ratings (initialize if needed)
  if (!data.closed_tickets) {
    data.closed_tickets = [];
  }

  // Add to closed tickets history (keep last 100)
  data.closed_tickets.unshift(ticket);
  if (data.closed_tickets.length > 100) {
    data.closed_tickets = data.closed_tickets.slice(0, 100);
  }

  // Remove from active tickets
  delete data.tickets[channel.id];
  saveJson(dataPath, data);

  // Request ticket rating (only if user was fetched successfully)
  if (user) {
    const { requestTicketRating } = require("./ticketEnhancements");
    await requestTicketRating(channel, ticket, user, config);
  }

  await channel.delete().catch(console.error);
  return ticket;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function logTicketMessage(message, data, dataPath) {
  if (!data || typeof data !== "object") {
    return;
  }
  if (!data.tickets || typeof data.tickets !== "object") {
    data.tickets = {};
  }
  const ticket = data.tickets[message.channel.id];
  if (ticket) {
    if (!Array.isArray(ticket.messages)) {
      ticket.messages = [];
    }
    ticket.messages.push({
      author: message.author.tag,
      content: message.content,
      timestamp: new Date().toISOString(),
    });
    saveJson(dataPath, data);
  }
}

module.exports = {
  createTicketPanel,
  createTicketFromButton,
  handleClaim,
  handleClose,
  handleCloseConfirm,
  handleCloseCancel,
  handleCloseTicketCommand,
  closeTicket,
  logTicketMessage,
  getPanelConfig,
  canManageTickets,
  DEFAULT_PANEL,
};

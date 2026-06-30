const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, MessageFlags } = require("discord.js");

const NAMED_COLORS = {
  blurple: 0x5865F2,
  red: 0xED4245,
  green: 0x57F287,
  yellow: 0xFEE75C,
  orange: 0xE67E22,
  purple: 0x9B59B6,
  pink: 0xEB459E,
  teal: 0x1ABC9C,
  blue: 0x3498DB,
  white: 0xFFFFFF,
  black: 0x000001,
  gold: 0xF1C40F,
  navy: 0x34495E,
  default: 0x522081,
};

function parseColor(input) {
  if (!input) return NAMED_COLORS.default;
  const lower = input.trim().toLowerCase();
  if (NAMED_COLORS[lower] !== undefined) return NAMED_COLORS[lower];
  const clean = lower.replace("#", "");
  const parsed = parseInt(clean, 16);
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) return parsed;
  return null; // invalid
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

/**
 * /embed create — basic embed modal
 */
async function showEmbedModal(interaction) {
  const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;

  const modal = new ModalBuilder()
    .setCustomId(`embed_create_${channelId}`)
    .setTitle("Send Embed to Channel");

  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Title (optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("📢 Patch Notes v1.4.2")
    .setRequired(false)
    .setMaxLength(256);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("embed_description")
    .setLabel("Description — Supports Discord Markdown")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("**Bold** *Italic* __Underline__ ~~Strike~~ `Code` ||Spoiler|| > Quote  # Heading  /embed format for help")
    .setRequired(true)
    .setMaxLength(4000);

  const colorInput = new TextInputBuilder()
    .setCustomId("embed_color")
    .setLabel("Color — Name or HEX (optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("blurple · red · green · gold · purple · #FF5733")
    .setRequired(false)
    .setMaxLength(20);

  const footerInput = new TextInputBuilder()
    .setCustomId("embed_footer")
    .setLabel("Footer Text (optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("LurkedAccounts · Posted by Staff")
    .setRequired(false)
    .setMaxLength(2048);

  const imageInput = new TextInputBuilder()
    .setCustomId("embed_image")
    .setLabel("Image URL (optional) — shown below description")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://example.com/banner.png")
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(footerInput),
    new ActionRowBuilder().addComponents(imageInput),
  );

  await interaction.showModal(modal);
}

/**
 * Handle basic embed submission
 */
async function handleEmbedSubmit(interaction, config) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelId = interaction.customId.replace("embed_create_", "");
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return interaction.editReply({ content: "❌ Could not find the target channel." });
  }

  const botMember = interaction.guild.members.me;
  if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
    return interaction.editReply({ content: `❌ I don't have permission to send messages in ${channel}.` });
  }

  const title = interaction.fields.getTextInputValue("embed_title");
  const description = interaction.fields.getTextInputValue("embed_description");
  const colorRaw = interaction.fields.getTextInputValue("embed_color");
  const footer = interaction.fields.getTextInputValue("embed_footer");
  const imageUrl = interaction.fields.getTextInputValue("embed_image");

  const color = parseColor(colorRaw);
  if (colorRaw && color === null) {
    return interaction.editReply({
      content: `❌ Invalid color \`${colorRaw}\`. Use a name (blurple, red, green, gold…) or a HEX code like \`#5865F2\`.`,
    });
  }

  if (imageUrl && !isValidUrl(imageUrl)) {
    return interaction.editReply({
      content: `❌ Invalid image URL. Make sure it starts with \`https://\` and points directly to an image.`,
    });
  }

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(color ?? NAMED_COLORS.default)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  if (imageUrl) embed.setImage(imageUrl);

  try {
    await channel.send({ embeds: [embed] });

    const confirm = new EmbedBuilder()
      .setDescription(`✅ Embed sent to ${channel}!`)
      .setColor(0x57F287);
    if (config.logo_url) confirm.setThumbnail(config.logo_url);

    await interaction.editReply({ embeds: [confirm] });
  } catch (error) {
    console.error("Error sending embed:", error);
    return interaction.editReply({ content: `❌ Failed to send embed: ${error.message}` });
  }
}

/**
 * /embed advanced — full embed modal
 */
async function showAdvancedEmbedModal(interaction) {
  const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;

  const modal = new ModalBuilder()
    .setCustomId(`embed_advanced_${channelId}`)
    .setTitle("Send Advanced Embed");

  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Title (optional, max 256 chars)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("📢 Announcement · 🛠️ Update · ⭐ Event")
    .setRequired(false)
    .setMaxLength(256);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("embed_description")
    .setLabel("Description — Supports Discord Markdown")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("**Bold** *Italic* __Underline__ ~~Strike~~ `Code` ||Spoiler|| > Quote  # Heading  /embed format for help")
    .setRequired(true)
    .setMaxLength(4000);

  const fieldsInput = new TextInputBuilder()
    .setCustomId("embed_fields")
    .setLabel("Advanced Fields (JSON) — optional")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('[{"name":"Status","value":"Online ✅","inline":true},{"name":"Version","value":"v1.2.0","inline":true}]')
    .setRequired(false)
    .setMaxLength(1000);

  const colorFooterInput = new TextInputBuilder()
    .setCustomId("embed_color_footer")
    .setLabel("Color | Footer Text (separate with |)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("blurple | Posted by Staff · or · #5865F2 | Footer here")
    .setRequired(false)
    .setMaxLength(300);

  const imagesInput = new TextInputBuilder()
    .setCustomId("embed_images")
    .setLabel("Image URL | Thumbnail URL (separate with |)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://example.com/banner.png | https://example.com/icon.png")
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(colorFooterInput),
    new ActionRowBuilder().addComponents(imagesInput),
    new ActionRowBuilder().addComponents(fieldsInput),
  );

  await interaction.showModal(modal);
}

/**
 * Handle advanced embed submission
 */
async function handleAdvancedEmbedSubmit(interaction, config) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelId = interaction.customId.replace("embed_advanced_", "");
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return interaction.editReply({ content: "❌ Could not find the target channel." });
  }

  const botMember = interaction.guild.members.me;
  if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
    return interaction.editReply({ content: `❌ I don't have permission to send messages in ${channel}.` });
  }

  const title = interaction.fields.getTextInputValue("embed_title");
  const description = interaction.fields.getTextInputValue("embed_description");
  const fieldsRaw = interaction.fields.getTextInputValue("embed_fields");
  const colorFooterRaw = interaction.fields.getTextInputValue("embed_color_footer");
  const imagesRaw = interaction.fields.getTextInputValue("embed_images");

  // Parse color and footer
  let colorInput = "";
  let footer = "";
  if (colorFooterRaw) {
    const parts = colorFooterRaw.split("|").map(s => s.trim());
    colorInput = parts[0] || "";
    footer = parts[1] || "";
  }

  const color = parseColor(colorInput);
  if (colorInput && color === null) {
    return interaction.editReply({
      content: `❌ Invalid color \`${colorInput}\`. Use a name (blurple, red, green, gold…) or a HEX code like \`#5865F2\`.`,
    });
  }

  // Parse images
  let imageUrl = "";
  let thumbnailUrl = "";
  if (imagesRaw) {
    const parts = imagesRaw.split("|").map(s => s.trim());
    imageUrl = parts[0] || "";
    thumbnailUrl = parts[1] || "";
  }

  const errors = [];
  if (imageUrl && !isValidUrl(imageUrl)) errors.push(`❌ Invalid image URL: \`${imageUrl}\``);
  if (thumbnailUrl && !isValidUrl(thumbnailUrl)) errors.push(`❌ Invalid thumbnail URL: \`${thumbnailUrl}\``);
  if (errors.length) {
    return interaction.editReply({
      content: errors.join("\n") + "\nMake sure URLs start with `https://`.",
    });
  }

  // Parse fields JSON
  let parsedFields = [];
  if (fieldsRaw) {
    try {
      const raw = JSON.parse(fieldsRaw);
      if (!Array.isArray(raw)) throw new Error("Fields must be a JSON array");
      parsedFields = raw
        .slice(0, 25)
        .filter(f => f.name && f.value)
        .map(f => ({
          name: String(f.name).slice(0, 256),
          value: String(f.value).slice(0, 1024),
          inline: f.inline === true,
        }));
    } catch (e) {
      return interaction.editReply({
        content: `❌ Invalid fields JSON.\n\`\`\`\n${e.message}\n\`\`\`\nExample:\n\`\`\`json\n[\n  { "name": "Field", "value": "Value", "inline": true }\n]\`\`\`\nTip: Run \`/embed format\` for a full cheat sheet.`,
      });
    }
  }

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(color ?? NAMED_COLORS.default)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  if (imageUrl) embed.setImage(imageUrl);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (parsedFields.length) embed.addFields(parsedFields);

  try {
    await channel.send({ embeds: [embed] });

    const confirm = new EmbedBuilder()
      .setDescription(`✅ Advanced embed sent to ${channel}!`)
      .setColor(0x57F287);
    if (config.logo_url) confirm.setThumbnail(config.logo_url);

    await interaction.editReply({ embeds: [confirm] });
  } catch (error) {
    console.error("Error sending advanced embed:", error);
    return interaction.editReply({ content: `❌ Failed to send embed: ${error.message}` });
  }
}

/**
 * /embed format — markdown & formatting cheat sheet
 */
async function showFormatHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("📋 Discord Embed Formatting Guide")
    .setColor(0x5865F2)
    .setDescription("Everything you can use inside your embed description.")
    .addFields(
      {
        name: "✏️ Text Formatting",
        value:
          "`**text**` → **Bold**\n" +
          "`*text*` → *Italic*\n" +
          "`__text__` → __Underline__\n" +
          "`~~text~~` → ~~Strikethrough~~\n" +
          "`||text||` → ||Spoiler||\n" +
          "`` `text` `` → `Inline code`",
        inline: true,
      },
      {
        name: "📐 Structure",
        value:
          "`# Heading` → Large heading\n" +
          "`## Heading` → Medium heading\n" +
          "`### Heading` → Small heading\n" +
          "`> text` → Block quote\n" +
          "`>>> text` → Multi-line quote\n" +
          "` ```code``` ` → Code block",
        inline: true,
      },
      {
        name: "🏷️ Mentions & Links",
        value:
          "`@everyone` `@here`\n" +
          "`<#channel-id>` → Channel\n" +
          "`<@user-id>` → User\n" +
          "`<@&role-id>` → Role\n" +
          "`[Text](https://url)` → Masked link",
        inline: true,
      },
      {
        name: "🕐 Timestamps",
        value:
          "Use `/embed timestamp` to generate these:\n" +
          "`<t:1234567890:t>` → Short time\n" +
          "`<t:1234567890:D>` → Long date\n" +
          "`<t:1234567890:F>` → Full date & time\n" +
          "`<t:1234567890:R>` → Relative (\"2 hours ago\")",
        inline: false,
      },
      {
        name: "🎨 Color Names",
        value:
          "`blurple` `red` `green` `yellow`\n" +
          "`orange` `purple` `pink` `teal`\n" +
          "`blue` `gold` `white` `black` `navy`\n" +
          "Or any HEX: `#5865F2`",
        inline: true,
      },
      {
        name: "📦 Fields JSON Example",
        value:
          "```json\n" +
          "[\n" +
          '  { "name": "Status", "value": "Online ✅", "inline": true },\n' +
          '  { "name": "Version", "value": "v1.2.0", "inline": true }\n' +
          "]\n```",
        inline: false,
      },
    )
    .setFooter({ text: "Use /embed create or /embed advanced to build your embed" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

/**
 * /embed timestamp — generate all Discord timestamp formats for right now
 */
async function showTimestampHelper(interaction) {
  const unix = Math.floor(Date.now() / 1000);

  const formats = [
    { style: "t", label: "Short Time",     example: "9:41 PM" },
    { style: "T", label: "Long Time",      example: "9:41:30 PM" },
    { style: "d", label: "Short Date",     example: "06/30/2026" },
    { style: "D", label: "Long Date",      example: "June 30, 2026" },
    { style: "f", label: "Date & Time",    example: "June 30, 2026 9:41 PM" },
    { style: "F", label: "Full Date/Time", example: "Tuesday, June 30, 2026 9:41 PM" },
    { style: "R", label: "Relative",       example: "just now / in 2 hours" },
  ];

  const rows = formats.map(f => {
    const syntax = `<t:${unix}:${f.style}>`;
    return `**${f.label}**\n\`${syntax}\` → ${f.example}`;
  }).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("🕐 Discord Timestamps — Right Now")
    .setColor(0x5865F2)
    .setDescription(`Unix timestamp: \`${unix}\`\nCopy any format below and paste into your embed.\n\n${rows}`)
    .setFooter({ text: "Timestamps display in each user's local timezone automatically" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = {
  showEmbedModal,
  handleEmbedSubmit,
  showAdvancedEmbedModal,
  handleAdvancedEmbedSubmit,
  showFormatHelp,
  showTimestampHelper,
};

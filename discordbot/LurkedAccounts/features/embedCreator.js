const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, MessageFlags } = require("discord.js");

/**
 * Show the embed creation modal
 */
async function showEmbedModal(interaction) {
  const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;

  const modal = new ModalBuilder()
    .setCustomId(`embed_create_${channelId}`)
    .setTitle("Create Custom Embed");

  // Title input
  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Embed Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter embed title (optional)")
    .setRequired(false)
    .setMaxLength(256);

  // Description input
  const descriptionInput = new TextInputBuilder()
    .setCustomId("embed_description")
    .setLabel("Embed Description")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter embed description")
    .setRequired(true)
    .setMaxLength(4000);

  // Color input
  const colorInput = new TextInputBuilder()
    .setCustomId("embed_color")
    .setLabel("Embed Color (hex code)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("#5865F2 or 5865F2")
    .setRequired(false)
    .setMaxLength(7);

  // Footer input
  const footerInput = new TextInputBuilder()
    .setCustomId("embed_footer")
    .setLabel("Footer Text")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter footer text (optional)")
    .setRequired(false)
    .setMaxLength(2048);

  // Image URL input
  const imageInput = new TextInputBuilder()
    .setCustomId("embed_image")
    .setLabel("Image URL")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://example.com/image.png (optional)")
    .setRequired(false)
    .setMaxLength(500);

  // Add inputs to action rows
  const row1 = new ActionRowBuilder().addComponents(titleInput);
  const row2 = new ActionRowBuilder().addComponents(descriptionInput);
  const row3 = new ActionRowBuilder().addComponents(colorInput);
  const row4 = new ActionRowBuilder().addComponents(footerInput);
  const row5 = new ActionRowBuilder().addComponents(imageInput);

  modal.addComponents(row1, row2, row3, row4, row5);

  await interaction.showModal(modal);
}

/**
 * Handle embed creation modal submission
 */
async function handleEmbedSubmit(interaction, config) {
  // Extract channel ID from custom ID
  const channelId = interaction.customId.replace("embed_create_", "");
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return interaction.reply({
      content: "❌ Could not find the target channel!",
      flags: MessageFlags.Ephemeral
    });
  }

  // Check if bot has permission to send messages in the channel
  const botMember = interaction.guild.members.me;
  if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
    return interaction.reply({
      content: `❌ I don't have permission to send messages in ${channel}!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Get modal inputs
  const title = interaction.fields.getTextInputValue("embed_title");
  const description = interaction.fields.getTextInputValue("embed_description");
  const colorInput = interaction.fields.getTextInputValue("embed_color");
  const footer = interaction.fields.getTextInputValue("embed_footer");
  const imageUrl = interaction.fields.getTextInputValue("embed_image");

  // Parse color
  let color = 0x522081; // Default Discord blue
  if (colorInput) {
    const cleanColor = colorInput.replace("#", "");
    const parsedColor = parseInt(cleanColor, 16);
    if (!isNaN(parsedColor) && parsedColor >= 0 && parsedColor <= 0xFFFFFF) {
      color = parsedColor;
    }
  }

  // Build the embed
  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(color);

  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  if (imageUrl) {
    // Validate URL
    try {
      new URL(imageUrl);
      embed.setImage(imageUrl);
    } catch (e) {
      // Invalid URL, skip
    }
  }

  // Add timestamp
  embed.setTimestamp();

  try {
    // Send the embed
    await channel.send({ embeds: [embed] });

    // Confirm to user
    const confirmEmbed = new EmbedBuilder()
      .setDescription(`✅ Embed sent successfully to ${channel}!`)
      .setColor(0x57F287);

    if (config.logo_url) {
      confirmEmbed.setThumbnail(config.logo_url);
    }

    await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error("Error sending embed:", error);
    return interaction.reply({
      content: `❌ Failed to send embed: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Show advanced embed creation modal with fields
 */
async function showAdvancedEmbedModal(interaction) {
  const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;

  const modal = new ModalBuilder()
    .setCustomId(`embed_advanced_${channelId}`)
    .setTitle("Create Advanced Embed");

  // Title input
  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Embed Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter embed title (optional)")
    .setRequired(false)
    .setMaxLength(256);

  // Description input
  const descriptionInput = new TextInputBuilder()
    .setCustomId("embed_description")
    .setLabel("Embed Description")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter embed description")
    .setRequired(true)
    .setMaxLength(4000);

  // Fields input (JSON format)
  const fieldsInput = new TextInputBuilder()
    .setCustomId("embed_fields")
    .setLabel("Fields (JSON format)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('[{"name":"Field 1","value":"Value 1","inline":true}]')
    .setRequired(false)
    .setMaxLength(1000);

  // Color and Footer
  const colorFooterInput = new TextInputBuilder()
    .setCustomId("embed_color_footer")
    .setLabel("Color | Footer (separated by |)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("#5865F2 | Footer text")
    .setRequired(false)
    .setMaxLength(300);

  // Image and Thumbnail URLs
  const imagesInput = new TextInputBuilder()
    .setCustomId("embed_images")
    .setLabel("Image URL | Thumbnail URL (separated by |)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://image.png | https://thumb.png")
    .setRequired(false)
    .setMaxLength(500);

  const row1 = new ActionRowBuilder().addComponents(titleInput);
  const row2 = new ActionRowBuilder().addComponents(descriptionInput);
  const row3 = new ActionRowBuilder().addComponents(fieldsInput);
  const row4 = new ActionRowBuilder().addComponents(colorFooterInput);
  const row5 = new ActionRowBuilder().addComponents(imagesInput);

  modal.addComponents(row1, row2, row3, row4, row5);

  await interaction.showModal(modal);
}

/**
 * Handle advanced embed creation modal submission
 */
async function handleAdvancedEmbedSubmit(interaction, config) {
  const channelId = interaction.customId.replace("embed_advanced_", "");
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return interaction.reply({
      content: "❌ Could not find the target channel!",
      flags: MessageFlags.Ephemeral
    });
  }

  const botMember = interaction.guild.members.me;
  if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
    return interaction.reply({
      content: `❌ I don't have permission to send messages in ${channel}!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Get modal inputs
  const title = interaction.fields.getTextInputValue("embed_title");
  const description = interaction.fields.getTextInputValue("embed_description");
  const fieldsInput = interaction.fields.getTextInputValue("embed_fields");
  const colorFooterInput = interaction.fields.getTextInputValue("embed_color_footer");
  const imagesInput = interaction.fields.getTextInputValue("embed_images");

  // Parse color and footer
  let color = 0x522081;
  let footer = "";
  if (colorFooterInput) {
    const parts = colorFooterInput.split("|").map(s => s.trim());
    if (parts[0]) {
      const cleanColor = parts[0].replace("#", "");
      const parsedColor = parseInt(cleanColor, 16);
      if (!isNaN(parsedColor) && parsedColor >= 0 && parsedColor <= 0xFFFFFF) {
        color = parsedColor;
      }
    }
    if (parts[1]) {
      footer = parts[1];
    }
  }

  // Parse images
  let imageUrl = "";
  let thumbnailUrl = "";
  if (imagesInput) {
    const parts = imagesInput.split("|").map(s => s.trim());
    imageUrl = parts[0] || "";
    thumbnailUrl = parts[1] || "";
  }

  // Build the embed
  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(color);

  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });

  // Add image and thumbnail
  if (imageUrl) {
    try {
      new URL(imageUrl);
      embed.setImage(imageUrl);
    } catch (e) {}
  }

  if (thumbnailUrl) {
    try {
      new URL(thumbnailUrl);
      embed.setThumbnail(thumbnailUrl);
    } catch (e) {}
  }

  // Parse and add fields
  if (fieldsInput) {
    try {
      const fields = JSON.parse(fieldsInput);
      if (Array.isArray(fields)) {
        for (const field of fields.slice(0, 25)) { // Max 25 fields
          if (field.name && field.value) {
            embed.addFields({
              name: field.name.slice(0, 256),
              value: field.value.slice(0, 1024),
              inline: field.inline === true
            });
          }
        }
      }
    } catch (e) {
      // Invalid JSON, skip fields
    }
  }

  embed.setTimestamp();

  try {
    await channel.send({ embeds: [embed] });

    const confirmEmbed = new EmbedBuilder()
      .setDescription(`✅ Advanced embed sent successfully to ${channel}!`)
      .setColor(0x57F287);

    if (config.logo_url) {
      confirmEmbed.setThumbnail(config.logo_url);
    }

    await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error("Error sending embed:", error);
    return interaction.reply({
      content: `❌ Failed to send embed: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = {
  showEmbedModal,
  handleEmbedSubmit,
  showAdvancedEmbedModal,
  handleAdvancedEmbedSubmit
};

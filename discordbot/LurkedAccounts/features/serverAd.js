const crypto = require("crypto");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { addLogo, saveJson } = require("../utils/fileManager");
const EMOJIS = require("../utils/emojis");

const DEFAULT_SERVER_AD = {
  website_url: "https://lurkedaccounts.tech/#home",
  discord_invite: "https://discord.gg/UekZuzk5gW",
  lurkedtv_url: "https://lurkedtv.vercel.app/#",
};

function normalizeHttpUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getServerAdConfig(config) {
  const saved = config.server_ad || {};

  return {
    website_url:
      normalizeHttpUrl(process.env.SERVER_AD_WEBSITE_URL) ||
      normalizeHttpUrl(saved.website_url) ||
      normalizeHttpUrl(process.env.FRONTEND_URL) ||
      DEFAULT_SERVER_AD.website_url,
    discord_invite:
      normalizeHttpUrl(process.env.SERVER_AD_DISCORD_INVITE) ||
      normalizeHttpUrl(saved.discord_invite) ||
      DEFAULT_SERVER_AD.discord_invite,
    lurkedtv_url:
      normalizeHttpUrl(process.env.SERVER_AD_LURKEDTV_URL) ||
      normalizeHttpUrl(saved.lurkedtv_url) ||
      DEFAULT_SERVER_AD.lurkedtv_url,
  };
}

function setServerAdConfig(config, updates) {
  const current = getServerAdConfig(config);
  const next = {
    website_url: updates.website_url || current.website_url,
    discord_invite: updates.discord_invite || current.discord_invite,
    lurkedtv_url: updates.lurkedtv_url || current.lurkedtv_url,
  };

  config.server_ad = {
    ...(config.server_ad || {}),
    ...next,
  };

  return next;
}

function buildServerAdMessage(config) {
  const ad = getServerAdConfig(config);
  const updatedAt = Math.floor(Date.now() / 1000);

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("LurkedAccounts")
      .setColor(0x522081)
      .setDescription(
        [
          `${EMOJIS.keritCross} **No payment.** ${EMOJIS.keritCross} **No premium.** ${EMOJIS.keritCross} **No hidden catch.**`,
          "",
          `${EMOJIS.diamondRotate} **__Free accounts, tools, and services built for the community.__**`,
          "> If you need account drops, useful utilities, or a place that actually keeps shipping, start here.",
          "",
          `${EMOJIS.free} **LurkedTweaks**`,
          "> A free Windows optimizer made to clean up the small annoyances, improve responsiveness, and keep your setup feeling fresh.",
          "",
          `${EMOJIS.web} **LurkedTV**`,
          `> Movies and series, free to watch, without turning a simple night into a scavenger hunt: **[Open LurkedTV](${ad.lurkedtv_url})**`,
          "",
          `${EMOJIS.fire} **Join once. Stay because it is useful.**`,
          `> Discord: **[Join LurkedAccounts](${ad.discord_invite})**`,
          `> Website: **[Open the site](${ad.website_url})**`,
          "",
          `${EMOJIS.question2} **What makes it worth joining?**`,
          "> Free drops, practical tools, forums, movie nights, and a team that keeps improving the platform instead of just talking about it.",
        ].join("\n")
      )
      .addFields(
        {
          name: `${EMOJIS.discordLoading} __Discord Invite__`,
          value: `\`\`\`text\n${ad.discord_invite}\n\`\`\``,
          inline: false,
        },
        {
          name: `${EMOJIS.web} __Website__`,
          value: `\`\`\`text\n${ad.website_url}\n\`\`\``,
          inline: true,
        },
        {
          name: `${EMOJIS.free} __LurkedTV__`,
          value: `\`\`\`text\n${ad.lurkedtv_url}\n\`\`\``,
          inline: true,
        }
      )
      .setFooter({ text: "LurkedAccounts | Free tools, services, and entertainment" })
      .setTimestamp(updatedAt * 1000),
    config
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Join Discord")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.discordLoading)
      .setURL(ad.discord_invite),
    new ButtonBuilder()
      .setLabel("Website")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.web)
      .setURL(ad.website_url),
    new ButtonBuilder()
      .setLabel("LurkedTV")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.free)
      .setURL(ad.lurkedtv_url)
  );

  return {
    embeds: [embed],
    components: [row],
  };
}

function hashServerAdContent(config) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(getServerAdConfig(config)))
    .digest("hex");
}

async function deleteTrackedServerAd(client, data) {
  if (!data.server_ad_message_id || !data.server_ad_channel_id) return false;

  const previousChannel = await client.channels
    .fetch(data.server_ad_channel_id)
    .catch(() => null);
  if (!previousChannel || !previousChannel.isTextBased()) return false;

  const previousMessage = await previousChannel.messages
    .fetch(data.server_ad_message_id)
    .catch(() => null);
  if (!previousMessage) return false;

  await previousMessage.delete().catch(() => {});
  return true;
}

async function upsertServerAd({
  channel,
  client,
  config,
  data,
  dataPath,
  forceRepost = false,
}) {
  const messageOptions = buildServerAdMessage(config);
  const contentHash = hashServerAdContent(config);
  const trackedChannelId = data.server_ad_channel_id;
  const trackedMessageId = data.server_ad_message_id;

  let action = "posted";
  let message = null;

  if (trackedMessageId && trackedChannelId === channel.id && !forceRepost) {
    message = await channel.messages.fetch(trackedMessageId).catch(() => null);
    if (message) {
      await message.edit(messageOptions);
      action = data.server_ad_content_hash === contentHash ? "refreshed" : "updated";
    }
  }

  if (!message) {
    if (trackedMessageId) {
      await deleteTrackedServerAd(client, data);
    }

    message = await channel.send(messageOptions);
    action = forceRepost ? "reposted" : action;
  }

  data.server_ad_channel_id = channel.id;
  data.server_ad_message_id = message.id;
  data.server_ad_content_hash = contentHash;
  data.server_ad_updated_at = new Date().toISOString();
  saveJson(dataPath, data);

  return {
    action,
    channelId: channel.id,
    messageId: message.id,
    config: getServerAdConfig(config),
  };
}

module.exports = {
  DEFAULT_SERVER_AD,
  getServerAdConfig,
  normalizeHttpUrl,
  setServerAdConfig,
  upsertServerAd,
};

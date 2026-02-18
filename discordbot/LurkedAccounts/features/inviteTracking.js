const { EmbedBuilder } = require("discord.js");
const { saveJson } = require("../utils/fileManager");
const { mention } = require("../utils/permissions");

/**
 * Fetch all guild invites and return a Map<code, { uses, inviterId }>
 */
async function cacheInvites(guild) {
  const cache = new Map();
  try {
    const invites = await guild.invites.fetch();
    for (const invite of invites.values()) {
      cache.set(invite.code, {
        uses: invite.uses,
        inviterId: invite.inviter?.id || null,
      });
    }
  } catch (error) {
    console.error("❌ Error caching invites:", error.message);
  }
  return cache;
}

/**
 * Compare old and new invite caches to find the used invite on member join.
 * Records the inviter and joined member in data.invite_tracking.
 * Returns the updated cache.
 */
async function handleMemberJoin(member, oldCache, data, dataPath) {
  const newCache = await cacheInvites(member.guild);

  if (!data.invite_tracking) {
    data.invite_tracking = { inviters: {}, joins: {} };
  }

  let usedInvite = null;

  // Find the invite whose uses count increased
  for (const [code, newInfo] of newCache) {
    const oldInfo = oldCache.get(code);
    if (oldInfo && newInfo.uses > oldInfo.uses) {
      usedInvite = { code, inviterId: newInfo.inviterId };
      break;
    }
    // New invite that wasn't in old cache and already has 1 use
    if (!oldInfo && newInfo.uses === 1) {
      usedInvite = { code, inviterId: newInfo.inviterId };
      break;
    }
  }

  if (usedInvite && usedInvite.inviterId) {
    const { code, inviterId } = usedInvite;

    // Record in inviters map
    if (!data.invite_tracking.inviters[inviterId]) {
      data.invite_tracking.inviters[inviterId] = {};
    }
    if (!data.invite_tracking.inviters[inviterId][code]) {
      data.invite_tracking.inviters[inviterId][code] = [];
    }
    data.invite_tracking.inviters[inviterId][code].push(String(member.id));

    // Record in joins map
    data.invite_tracking.joins[String(member.id)] = {
      invited_by: inviterId,
      code,
      joined_at: new Date().toISOString(),
    };

    saveJson(dataPath, data);
    console.log(
      `📨 ${member.user.tag} joined via invite ${code} by ${inviterId}`
    );
  } else {
    console.log(
      `📨 ${member.user.tag} joined but invite could not be determined`
    );
  }

  return newCache;
}

/**
 * Build an embed showing a user's invite stats (total, per-code breakdown).
 */
async function showInviteStats(interaction, data, config) {
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const userId = String(targetUser.id);

  if (!data.invite_tracking) {
    data.invite_tracking = { inviters: {}, joins: {} };
  }

  const inviterData = data.invite_tracking.inviters[userId];

  // Also show who invited this user
  const joinInfo = data.invite_tracking.joins[userId];

  if (!inviterData && !joinInfo) {
    const embed = new EmbedBuilder()
      .setDescription(`No invite data found for ${mention(userId)}.`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Invite Stats for ${targetUser.displayName}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
    .setColor(0x522081)
    .setTimestamp();

  // Who invited this user
  if (joinInfo) {
    const joinTimestamp = Math.floor(Date.parse(joinInfo.joined_at) / 1000);
    embed.addFields({
      name: "Invited By",
      value: `${mention(joinInfo.invited_by)} using code \`${joinInfo.code}\` (<t:${joinTimestamp}:R>)`,
    });
  }

  // Invite breakdown
  if (inviterData) {
    let total = 0;
    const codeLines = [];

    for (const [code, members] of Object.entries(inviterData)) {
      total += members.length;
      const memberMentions =
        members.length <= 5
          ? members.map((id) => mention(id)).join(", ")
          : members
              .slice(0, 5)
              .map((id) => mention(id))
              .join(", ") + ` and ${members.length - 5} more`;
      codeLines.push(
        `\`${code}\` — **${members.length}** join${members.length !== 1 ? "s" : ""}\n${memberMentions}`
      );
    }

    embed.addFields({
      name: `Total Invites: ${total}`,
      value: codeLines.join("\n\n") || "None",
    });
  }

  await interaction.reply({ embeds: [embed] });
}

/**
 * Build an embed showing the top inviters leaderboard.
 */
async function showInviteLeaderboard(interaction, data, config) {
  if (!data.invite_tracking) {
    data.invite_tracking = { inviters: {}, joins: {} };
  }

  const inviters = data.invite_tracking.inviters;
  const entries = [];

  for (const [userId, codes] of Object.entries(inviters)) {
    let total = 0;
    for (const members of Object.values(codes)) {
      total += members.length;
    }
    entries.push({ userId, total });
  }

  entries.sort((a, b) => b.total - a.total);
  const top = entries.slice(0, 10);

  if (top.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("No invite data recorded yet.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = top.map((entry, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    return `${medal} ${mention(entry.userId)} — **${entry.total}** invite${entry.total !== 1 ? "s" : ""}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("Invite Leaderboard")
    .setDescription(lines.join("\n"))
    .setColor(0x522081)
    .setFooter({ text: `Top ${top.length} inviter${top.length !== 1 ? "s" : ""}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

module.exports = {
  cacheInvites,
  handleMemberJoin,
  showInviteStats,
  showInviteLeaderboard,
};

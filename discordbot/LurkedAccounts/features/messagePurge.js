const { PermissionFlagsBits } = require("discord.js");

async function purgeUserMessagesLastDays(guild, userId, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!me) return 0;

  let totalDeleted = 0;

  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased || !channel.isTextBased()) continue;
    if (typeof channel.messages?.fetch !== "function") continue;
    if (typeof channel.bulkDelete !== "function") continue;

    const perms = channel.permissionsFor(me);
    if (!perms) continue;
    if (!perms.has(PermissionFlagsBits.ViewChannel)) continue;
    if (!perms.has(PermissionFlagsBits.ReadMessageHistory)) continue;
    if (!perms.has(PermissionFlagsBits.ManageMessages)) continue;

    let before;
    while (true) {
      const messages = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
      if (!messages || messages.size === 0) break;

      const recentMessages = messages.filter((msg) => msg.createdTimestamp >= cutoff);
      if (recentMessages.size === 0) break;

      const userMessages = recentMessages.filter((msg) => msg.author && msg.author.id === userId);
      if (userMessages.size > 0) {
        const batches = Array.from(userMessages.values());
        for (let i = 0; i < batches.length; i += 100) {
          const chunk = batches.slice(i, i + 100);
          const deleted = await channel.bulkDelete(chunk, true).catch(() => null);
          if (deleted) totalDeleted += deleted.size;
        }
      }

      const oldest = messages.last();
      if (!oldest || oldest.createdTimestamp < cutoff) break;
      before = oldest.id;
    }
  }

  return totalDeleted;
}

module.exports = {
  purgeUserMessagesLastDays,
};

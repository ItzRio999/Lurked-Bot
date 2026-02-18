const express = require('express');
const router = express.Router();
const { EmbedBuilder } = require('discord.js');
const { loadJson, saveJson, DATA_PATH } = require('../utils/fileManager');
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');

/**
 * Resolve a Discord user to a plain object safe for JSON
 */
async function resolveUser(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return {
      id: userId,
      username: user.username,
      displayName: user.globalName || user.username,
      avatar: user.displayAvatarURL({ size: 64, extension: 'png' }),
    };
  } catch {
    return { id: userId, username: `Unknown (${userId})`, displayName: `Unknown`, avatar: null };
  }
}

/**
 * GET /api/giveaways
 * Returns all giveaways with resolved entry/host/winner info. Admin only.
 */
router.get('/giveaways', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const data = loadJson(DATA_PATH, {});
    const giveaways = Array.isArray(data.giveaways) ? data.giveaways : [];

    const enriched = await Promise.all(
      giveaways.map(async (g) => {
        const [entries, host, winners] = await Promise.all([
          Promise.all((g.entries || []).map((id) => resolveUser(client, id))),
          resolveUser(client, g.host_id),
          g.winner_ids?.length
            ? Promise.all(g.winner_ids.map((id) => resolveUser(client, id)))
            : Promise.resolve([]),
        ]);

        return {
          message_id: g.message_id,
          channel_id: g.channel_id,
          guild_id: g.guild_id,
          prize: g.prize,
          description: g.description || null,
          winners_count: g.winners,
          end_time: g.end_time,
          ended: g.ended,
          image_url: g.image_url || null,
          host,
          entries,
          winners,
          entry_count: entries.length,
        };
      })
    );

    // Sort: active first (soonest ending first), then ended (most recently ended last)
    enriched.sort((a, b) => {
      if (!a.ended && !b.ended) return a.end_time - b.end_time;
      if (!a.ended) return -1;
      if (!b.ended) return 1;
      return b.end_time - a.end_time;
    });

    res.json({ success: true, giveaways: enriched });
  } catch (error) {
    console.error('Error fetching giveaways:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch giveaways' });
  }
});

/**
 * POST /api/giveaways/:messageId/end
 * End an active giveaway early. Admin only.
 */
router.post('/giveaways/:messageId/end', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const client = req.app.locals.client;
    const data = loadJson(DATA_PATH, {});
    const giveaway = Array.isArray(data.giveaways)
      ? data.giveaways.find((g) => g.message_id === messageId)
      : null;

    if (!giveaway) {
      return res.status(404).json({ success: false, error: 'Giveaway not found' });
    }
    if (giveaway.ended) {
      return res.status(400).json({ success: false, error: 'Giveaway already ended' });
    }

    const { finalizeGiveaway } = require('../features/giveaways');
    const channel = await client.channels.fetch(giveaway.channel_id);
    const message = await channel.messages.fetch(messageId);
    await finalizeGiveaway(message, giveaway, data, DATA_PATH, client);

    res.json({ success: true, message: 'Giveaway ended successfully' });
  } catch (error) {
    console.error('Error ending giveaway:', error);
    res.status(500).json({ success: false, error: 'Failed to end giveaway' });
  }
});

/**
 * POST /api/giveaways/:messageId/reroll
 * Reroll winners for an ended giveaway. Admin only.
 * Body: { winners: number }
 */
router.post('/giveaways/:messageId/reroll', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const winnerCount = Math.max(1, parseInt(req.body.winners) || 1);
    const client = req.app.locals.client;
    const data = loadJson(DATA_PATH, {});
    const giveaway = Array.isArray(data.giveaways)
      ? data.giveaways.find((g) => g.message_id === messageId)
      : null;

    if (!giveaway) {
      return res.status(404).json({ success: false, error: 'Giveaway not found' });
    }
    if (!giveaway.ended) {
      return res.status(400).json({ success: false, error: 'Giveaway has not ended yet' });
    }

    const entries = giveaway.entries || [];
    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No entries to pick from' });
    }

    const count = Math.min(winnerCount, entries.length);
    const pool = [...entries];
    const newWinners = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      newWinners.push(pool[idx]);
      pool.splice(idx, 1);
    }

    const channel = await client.channels.fetch(giveaway.channel_id);
    const winnerMentions = newWinners.map((id) => `<@${id}>`).join(', ');

    const rerollEmbed = new EmbedBuilder()
      .setTitle('Giveaway Rerolled')
      .setDescription(
        `**Prize:** ${giveaway.prize}\n\n` +
        `**New Winner${newWinners.length !== 1 ? 's' : ''}:** ${winnerMentions}`
      )
      .setColor(0x57F287)
      .setTimestamp();

    await channel.send({ content: winnerMentions, embeds: [rerollEmbed] });

    giveaway.winner_ids = newWinners;
    saveJson(DATA_PATH, data);

    res.json({ success: true, winners: newWinners, message: 'Rerolled successfully' });
  } catch (error) {
    console.error('Error rerolling giveaway:', error);
    res.status(500).json({ success: false, error: 'Failed to reroll giveaway' });
  }
});

/**
 * DELETE /api/giveaways/:messageId/entries/:userId
 * Remove a specific user from a giveaway's entries. Admin only.
 */
router.delete('/giveaways/:messageId/entries/:userId', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { messageId, userId } = req.params;
    const data = loadJson(DATA_PATH, {});
    const giveaway = Array.isArray(data.giveaways)
      ? data.giveaways.find((g) => g.message_id === messageId)
      : null;

    if (!giveaway) {
      return res.status(404).json({ success: false, error: 'Giveaway not found' });
    }
    if (giveaway.ended) {
      return res.status(400).json({ success: false, error: 'Cannot modify entries of an ended giveaway' });
    }

    const before = giveaway.entries.length;
    giveaway.entries = giveaway.entries.filter((id) => id !== userId);

    if (giveaway.entries.length === before) {
      return res.status(404).json({ success: false, error: 'User not found in entries' });
    }

    saveJson(DATA_PATH, data);
    res.json({ success: true, entry_count: giveaway.entries.length });
  } catch (error) {
    console.error('Error removing giveaway entry:', error);
    res.status(500).json({ success: false, error: 'Failed to remove entry' });
  }
});

module.exports = router;

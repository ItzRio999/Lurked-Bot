const express = require('express');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');

// GET /api/bot/tickets - Get all tickets (admin only)
router.get('/tickets', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const data = req.app.locals.data;
    const client = req.app.locals.client;

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Bot data not loaded'
      });
    }

    // Get open tickets
    const openTickets = [];
    if (data.tickets) {
      for (const [channelId, ticketInfo] of Object.entries(data.tickets)) {
        const channel = client.channels.cache.get(channelId);
        openTickets.push({
          id: channelId,
          channelId: channelId,
          channelName: channel?.name || 'Unknown',
          user: ticketInfo.user || 'Unknown',
          userId: ticketInfo.userId,
          createdAt: ticketInfo.createdAt || new Date().toISOString(),
          reason: ticketInfo.reason || null,
          claimedBy: ticketInfo.claimedBy || null
        });
      }
    }

    // Get closed tickets (last 50)
    const closedTickets = [];
    if (data.closed_tickets) {
      const closedEntries = Object.entries(data.closed_tickets)
        .sort((a, b) => {
          const dateA = new Date(b[1].closedAt || 0);
          const dateB = new Date(a[1].closedAt || 0);
          return dateA - dateB;
        })
        .slice(0, 50);

      for (const [channelId, ticketInfo] of closedEntries) {
        closedTickets.push({
          id: channelId,
          channelId: channelId,
          channelName: ticketInfo.channelName || 'Unknown',
          user: ticketInfo.user || 'Unknown',
          userId: ticketInfo.userId,
          createdAt: ticketInfo.createdAt || null,
          closedAt: ticketInfo.closedAt || null,
          closedBy: ticketInfo.closedBy || null,
          closedReason: ticketInfo.closedReason || null,
          reason: ticketInfo.reason || null
        });
      }
    }

    res.json({
      success: true,
      data: {
        open: openTickets,
        closed: closedTickets
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets'
    });
  }
});

// GET /api/bot/tickets/:ticketId/messages - Get messages from a ticket (admin only)
router.get('/tickets/:ticketId/messages', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const client = req.app.locals.client;
    const limit = parseInt(req.query.limit) || 50;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    // Get the ticket channel
    const ticketChannel = client.channels.cache.get(ticketId);
    if (!ticketChannel) {
      return res.status(404).json({
        success: false,
        error: 'Ticket channel not found'
      });
    }

    // Fetch messages from the channel
    const messages = await ticketChannel.messages.fetch({ limit });

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        discriminator: msg.author.discriminator,
        avatar: msg.author.displayAvatarURL(),
        bot: msg.author.bot
      },
      timestamp: msg.createdTimestamp,
      embeds: msg.embeds.length > 0 ? msg.embeds.map(e => ({
        title: e.title,
        description: e.description,
        color: e.color,
        fields: e.fields
      })) : [],
      attachments: msg.attachments.size > 0 ? msg.attachments.map(a => ({
        name: a.name,
        url: a.url,
        size: a.size
      })) : []
    })).reverse(); // Reverse to show oldest first

    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        channelName: ticketChannel.name
      }
    });

  } catch (error) {
    console.error('❌ Error fetching ticket messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticket messages'
    });
  }
});

// POST /api/bot/tickets/:ticketId/messages - Send a message to a ticket (admin only)
router.post('/tickets/:ticketId/messages', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const client = req.app.locals.client;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message is too long (max 2000 characters)'
      });
    }

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    // Get the ticket channel
    const ticketChannel = client.channels.cache.get(ticketId);
    if (!ticketChannel) {
      return res.status(404).json({
        success: false,
        error: 'Ticket channel not found'
      });
    }

    // Send the message
    const sentMessage = await ticketChannel.send({
      content: message,
      embeds: [{
        color: 0x8B5CF6,
        footer: {
          text: `Sent by ${req.user.email} via Dashboard`
        },
        timestamp: new Date().toISOString()
      }]
    });

    // Format the sent message for response
    const formattedMessage = {
      id: sentMessage.id,
      content: sentMessage.content,
      author: {
        id: sentMessage.author.id,
        username: sentMessage.author.username,
        discriminator: sentMessage.author.discriminator,
        avatar: sentMessage.author.displayAvatarURL(),
        bot: sentMessage.author.bot
      },
      timestamp: sentMessage.createdTimestamp,
      embeds: sentMessage.embeds.map(e => ({
        title: e.title,
        description: e.description,
        color: e.color,
        footer: e.footer
      }))
    };

    res.json({
      success: true,
      data: {
        message: formattedMessage
      }
    });

  } catch (error) {
    console.error('❌ Error sending ticket message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// POST /api/bot/tickets/:ticketId/close - Close a ticket (admin only)
router.post('/tickets/:ticketId/close', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const client = req.app.locals.client;
    const data = req.app.locals.data;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    if (!data || !data.tickets || !data.tickets[ticketId]) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Get the ticket channel
    const ticketChannel = client.channels.cache.get(ticketId);
    if (!ticketChannel) {
      return res.status(404).json({
        success: false,
        error: 'Ticket channel not found'
      });
    }

    const ticketInfo = data.tickets[ticketId];

    try {
      // Send closing message
      await ticketChannel.send({
        embeds: [{
          color: 0xFF6B6B,
          title: '🔒 Ticket Closed',
          description: 'This ticket has been closed by an administrator via the web dashboard.',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Ticket System'
          }
        }]
      });

      // Wait a moment before deleting
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Delete the ticket channel
      await ticketChannel.delete('Ticket closed by admin via dashboard');

      // Move to closed tickets
      if (!data.closed_tickets) {
        data.closed_tickets = {};
      }

      data.closed_tickets[ticketId] = {
        ...ticketInfo,
        channelName: ticketChannel.name,
        closedAt: new Date().toISOString(),
        closedBy: req.user.email,
        closedReason: 'manual'
      };

      // Remove from open tickets
      delete data.tickets[ticketId];

      // Save data
      const { saveJson, DATA_PATH } = require('../utils/fileManager');
      saveJson(DATA_PATH, data);

      res.json({
        success: true,
        message: 'Ticket closed successfully'
      });

    } catch (channelError) {
      console.error('Error closing ticket channel:', channelError);

      // Still remove from open tickets even if channel deletion failed
      if (!data.closed_tickets) {
        data.closed_tickets = {};
      }

      data.closed_tickets[ticketId] = {
        ...ticketInfo,
        closedAt: new Date().toISOString(),
        closedBy: req.user.email,
        closedReason: 'manual'
      };

      delete data.tickets[ticketId];

      const { saveJson, DATA_PATH } = require('../utils/fileManager');
      saveJson(DATA_PATH, data);

      res.json({
        success: true,
        message: 'Ticket closed (channel may have been already deleted)'
      });
    }

  } catch (error) {
    console.error('❌ Error closing ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close ticket'
    });
  }
});

module.exports = router;

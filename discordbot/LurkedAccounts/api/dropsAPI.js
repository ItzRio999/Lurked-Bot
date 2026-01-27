const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');
const { uploadLimiter, deleteLimiter } = require('../middleware/rateLimiter');

// Temporary upload directory
const DROPS_DIR = path.join(__dirname, '..', 'drops');

// Ensure drops directory exists for temp uploads
if (!fs.existsSync(DROPS_DIR)) {
  fs.mkdirSync(DROPS_DIR, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DROPS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
    const uniqueName = `${Date.now()}_${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept .txt files (can expand to other types later)
    if (file.originalname.toLowerCase().endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  }
});

// POST /api/upload-drop - Upload drop to Discord channel
router.post('/upload-drop', uploadLimiter, verifyAuth, verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    let { title, description, type } = req.body;
    const file = req.file;
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    // Remove leading # and any spaces from title
    title = title.replace(/^#\s*/, '');

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    if (!config.drops_channel_id) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not configured'
      });
    }

    // Fetch Discord channel
    const channel = await client.channels.fetch(config.drops_channel_id);

    if (!channel || !channel.isTextBased()) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not found'
      });
    }

    // Create message content
    const messageContent = `${title}\n${description || ''}`;

    // Post to Discord with file attachment
    const message = await channel.send({
      content: messageContent,
      files: [{
        attachment: file.path,
        name: file.originalname
      }]
    });

    // Delete temporary file after upload
    fs.unlinkSync(file.path);

    console.log(`✅ Drop posted to Discord: "${title}" (Message ID: ${message.id})`);

    // Emit WebSocket event for new drop
    const io = req.app.locals.io;
    if (io) {
      const dropData = {
        id: message.id,
        attachmentId: message.attachments.first()?.id,
        title: title,
        description: description || '',
        type: type || 'account',
        fileName: file.originalname,
        fileSize: file.size,
        createdAt: message.createdAt.toISOString(),
        source: 'discord'
      };
      io.emit('dropAdded', dropData);
      console.log(`🔔 WebSocket: Emitted dropAdded event for "${title}"`);
    }

    res.json({
      success: true,
      dropId: message.id,
      fileName: file.originalname,
      message: 'Drop posted to Discord successfully'
    });

  } catch (error) {
    console.error('❌ Error uploading drop to Discord:', error);

    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload drop'
    });
  }
});

// GET /api/drops - Fetch drops from Discord channel
router.get('/drops', async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    if (!config.drops_channel_id) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not configured'
      });
    }

    // Fetch Discord channel
    const channel = await client.channels.fetch(config.drops_channel_id);

    if (!channel || !channel.isTextBased()) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not found'
      });
    }

    // Fetch all messages with .txt attachments
    let allMessages = [];
    let lastMessageId = null;

    // Fetch in batches of 100
    let fetchedBatch;
    do {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      fetchedBatch = await channel.messages.fetch(options);
      allMessages.push(...fetchedBatch.values());

      if (fetchedBatch.size > 0) {
        lastMessageId = fetchedBatch.last().id;
      }
    } while (fetchedBatch.size === 100);

    // Filter for messages with .txt attachments
    const drops = [];
    for (const message of allMessages) {
      const txtAttachments = message.attachments.filter(att =>
        att.name && att.name.toLowerCase().endsWith('.txt')
      );

      for (const [attId, attachment] of txtAttachments) {
        // Parse title from first line of message content
        let title = attachment.name.replace('.txt', '');
        let description = '';

        if (message.content) {
          const lines = message.content.trim().split('\n');
          if (lines.length > 0 && lines[0].trim()) {
            title = lines[0].trim();
          }
          if (lines.length > 1) {
            description = lines.slice(1).join('\n').trim();
          }
        }

        // Remove leading # and any spaces
        title = title.replace(/^#\s*/, '');

        drops.push({
          id: message.id, // Use Discord message ID
          attachmentId: attId,
          title: title,
          description: description,
          type: 'account', // Default type
          fileName: attachment.name,
          fileSize: attachment.size,
          createdAt: message.createdAt.toISOString(),
          source: 'discord'
        });
      }
    }

    // Sort by newest first
    drops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, drops });

  } catch (error) {
    console.error('❌ Error fetching drops from Discord:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drops'
    });
  }
});

// GET /api/download/:dropId - Download drop from Discord
router.get('/download/:dropId', async (req, res) => {
  try {
    const { dropId } = req.params; // This is the Discord message ID
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    // Fetch Discord channel
    const channel = await client.channels.fetch(config.drops_channel_id);

    if (!channel) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not found'
      });
    }

    // Fetch the specific message
    const message = await channel.messages.fetch(dropId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Drop not found'
      });
    }

    // Find .txt attachment
    const txtAttachment = message.attachments.find(att =>
      att.name && att.name.toLowerCase().endsWith('.txt')
    );

    if (!txtAttachment) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Fetch file content from Discord CDN
    const fetch = require('node-fetch');
    const fileResponse = await fetch(txtAttachment.url);

    if (!fileResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch file from Discord'
      });
    }

    const fileBuffer = await fileResponse.buffer();

    // Send file as download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${txtAttachment.name}"`);
    res.send(fileBuffer);

    console.log(`📥 Downloaded: ${txtAttachment.name} (Message ID: ${dropId})`);

  } catch (error) {
    console.error('❌ Error downloading drop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file'
    });
  }
});

// DELETE /api/drop/:dropId - Delete drop from Discord
router.delete('/drop/:dropId', deleteLimiter, verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { dropId } = req.params; // Discord message ID
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not ready'
      });
    }

    // Fetch Discord channel
    const channel = await client.channels.fetch(config.drops_channel_id);

    if (!channel) {
      return res.status(500).json({
        success: false,
        error: 'Drops channel not found'
      });
    }

    // Fetch and delete the message
    const message = await channel.messages.fetch(dropId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Drop not found'
      });
    }

    await message.delete();

    console.log(`🗑️ Deleted drop message: ${dropId}`);

    // Emit WebSocket event for deleted drop
    const io = req.app.locals.io;
    if (io) {
      io.emit('dropDeleted', { id: dropId });
      console.log(`🔔 WebSocket: Emitted dropDeleted event for ${dropId}`);
    }

    res.json({
      success: true,
      message: 'Drop deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting drop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete drop'
    });
  }
});

module.exports = router;

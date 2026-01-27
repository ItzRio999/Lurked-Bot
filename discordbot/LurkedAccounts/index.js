// Load environment variables first
require("dotenv").config();

const { Client, GatewayIntentBits, Partials, REST, Routes, ActivityType } = require("discord.js");
const { loadJson, CONFIG_PATH, DATA_PATH } = require("./utils/fileManager");
const { hasStaffRole } = require("./utils/permissions");
const { handleInteraction } = require("./handlers/interactions");
const commands = require("./handlers/commands");
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Lazy-load feature modules (loaded on-demand for better memory efficiency on Pi)
let ticketsModule, staffTrackingModule, boostTrackingModule;
let welcomeModule, auditLogsModule, pollsModule, giveawaysModule, automodModule, ticketEnhancementsModule;
let verificationModule, dropSyncModule;

// Load configuration and data
const config = loadJson(CONFIG_PATH, null);
if (!config) {
  throw new Error("Missing config.json. Copy config.example.json to config.json and edit it.");
}

// Override token with environment variable if available
if (process.env.DISCORD_TOKEN) {
  config.token = process.env.DISCORD_TOKEN;
}

// Validate token
if (!config.token) {
  throw new Error("Missing Discord token! Set DISCORD_TOKEN in .env file or add token to config.json");
}

const data = loadJson(DATA_PATH, {
  staff_activity: {},
  boost_log: [],
  tickets: {},
  ticket_counter: 0,
  closed_tickets: [],
  polls: {},
  message_cache: {},
  automod_strikes: {},
  giveaways: {}
});

// Initialize Discord client with optimizations for Raspberry Pi
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences, // For member status tracking
  ],
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
  // Optimize sweepers for low-memory devices (Pi 3B+)
  sweepers: {
    // Sweep caches periodically to free memory
    messages: {
      interval: 300, // Every 5 minutes
      lifetime: 900, // Messages older than 15 minutes
    },
    users: {
      interval: 3600, // Every hour
      filter: () => user => user.bot && user.id !== client.user?.id,
    },
  },
});

// Initialize Express API server for web uploads
const app = express();
const httpServer = http.createServer(app);
const API_PORT = process.env.API_PORT || 3002;
const CORS_ORIGIN = process.env.API_CORS_ORIGIN || 'http://localhost:5173';

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN.split(',').map(o => o.trim()),
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: CORS_ORIGIN.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  credentials: true
}));
app.use(express.json());

// Make Discord client, config, and Socket.IO available to routes
app.locals.client = client;
app.locals.config = config;
app.locals.io = io;

// Also store io in client for easy access in event handlers
client.io = io;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Discord bot API is running',
    botReady: client.isReady()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`✅ WebSocket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ WebSocket client disconnected: ${socket.id}`);
  });
});

// Start API server immediately (routes work once bot is ready)
httpServer.listen(API_PORT, () => {
  console.log(`✅ Discord bot API listening on port ${API_PORT}`);
  console.log(`✅ WebSocket server ready`);
});

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);

  try {
    console.log("Started refreshing application (/) commands.");

    // Support both guild_ids array and legacy guild_id
    const guildIds = config.guild_ids || (config.guild_id ? [config.guild_id] : []);

    if (guildIds.length > 0) {
      // Register to multiple guilds
      for (const guildId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(config.client_id, guildId), {
          body: commands,
        });
        console.log(`✅ Successfully registered commands to guild: ${guildId}`);
      }
    } else {
      // Register globally if no guilds specified
      await rest.put(Routes.applicationCommands(config.client_id), { body: commands });
      console.log("✅ Successfully registered global slash commands.");
    }
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

// ============== EVENT HANDLERS ==============

client.on("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);

  // Check drop sync configuration
  // Drop sync disabled - using Discord as direct source of truth
  // dropSyncModule = require("./features/dropSync");
  // const dropSyncStatus = dropSyncModule.isConfigured(config);
  // if (dropSyncStatus.configured) {
  //   dropSyncModule.initializeFirebase();
  //   console.log(`🔄 Drop sync enabled - monitoring channel ${config.drops_channel_id}`);

  //   // Sync existing drops from channel history
  //   dropSyncModule.syncExistingDrops(client, config).catch((error) => {
  //     console.error("❌ Error syncing existing drops:", error.message);
  //   });
  // } else {
  //   console.log(`⚠️ Drop sync disabled: ${dropSyncStatus.reason}`);
  // }
  console.log(`📥 Drops system configured - channel: ${config.drops_channel_id}`);

  // Load drops API routes
  const dropsAPI = require('./api/dropsAPI');
  app.use('/api', dropsAPI);
  console.log('✅ Drops API routes loaded');

  // Load team API routes
  const teamAPI = require('./api/teamAPI');
  app.use(teamAPI);
  console.log('✅ Team API routes loaded');

  // Load events API routes
  const eventsAPI = require('./api/eventsAPI');
  app.use(eventsAPI);
  console.log('✅ Events API routes loaded');

  // Log all registered routes for debugging
  console.log('\n📍 Registered API routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          console.log(`  ${Object.keys(handler.route.methods).join(', ').toUpperCase()} ${handler.route.path}`);
        }
      });
    }
  });
  console.log('\n');

  // 404 handler for API routes - must be after all route definitions
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.url}`,
      availableRoutes: [
        'GET /api/events',
        'POST /api/events',
        'DELETE /api/events/:eventId',
        'GET /api/drops',
        'POST /api/upload-drop',
        'DELETE /api/drop/:dropId',
        'GET /api/team'
      ]
    });
  });

  // Fetch all guild members for team showcase feature
  try {
    for (const guild of client.guilds.cache.values()) {
      await guild.members.fetch();
      console.log(`👥 Cached ${guild.memberCount} members from ${guild.name}`);
    }
  } catch (error) {
    console.error('⚠️ Error fetching guild members:', error);
  }

  // Enhanced rotating status messages with Rich Presence
  const statuses = [
    { name: "your support tickets 🎫", type: ActivityType.Watching, state: "Managing Tickets" },
    { name: "Lurked Accounts 🔐", type: ActivityType.Playing, state: "Premium Service" },
    { name: "with premium services 💎", type: ActivityType.Playing, state: "Elite Access" },
    { name: "staff performance 📊", type: ActivityType.Watching, state: "Tracking Activity" },
    { name: "to /help commands ❓", type: ActivityType.Listening, state: "Ready to Assist" },
    { name: `${client.guilds.cache.size} server${client.guilds.cache.size !== 1 ? 's' : ''} 🌐`, type: ActivityType.Watching, state: "Multi-Server" },
    { name: "for bad words 🛡️", type: ActivityType.Watching, state: "Auto-Moderation" },
  ];

  let currentStatus = 0;

  // Set initial status with Rich Presence
  client.user.setPresence({
    activities: [{
      name: statuses[0].name,
      type: statuses[0].type,
      state: statuses[0].state
    }],
    status: 'online'
  });

  // Rotate status every 45 seconds for more dynamic presence
  setInterval(() => {
    currentStatus = (currentStatus + 1) % statuses.length;
    client.user.setPresence({
      activities: [{
        name: statuses[currentStatus].name,
        type: statuses[currentStatus].type,
        state: statuses[currentStatus].state
      }],
      status: 'online'
    });
  }, 45000);

  // Resume active polls on bot restart (lazy load)
  pollsModule = require("./features/polls");
  for (const [messageId, poll] of Object.entries(data.polls || {})) {
    if (poll.active && poll.end_time > Date.now()) {
      const remaining = poll.end_time - Date.now();
      const guild = client.guilds.cache.first();
      if (guild) {
        setTimeout(() => pollsModule.endPoll(messageId, guild, data, DATA_PATH), remaining);
      }
    }
  }

  // Check for expired giveaways every 60 seconds (reduced from 30s for Pi)
  giveawaysModule = require("./features/giveaways");
  setInterval(() => {
    giveawaysModule.checkGiveaways(client, data, DATA_PATH);
  }, 60000);

  // Initial giveaway check
  giveawaysModule.checkGiveaways(client, data, DATA_PATH);

  // Check for inactive tickets every 2 hours (reduced from 1h for Pi)
  ticketEnhancementsModule = require("./features/ticketEnhancements");
  setInterval(() => {
    ticketEnhancementsModule.checkInactiveTickets(client, data, DATA_PATH, config);
  }, 2 * 60 * 60 * 1000);

  // Initial inactive ticket check
  ticketEnhancementsModule.checkInactiveTickets(client, data, DATA_PATH, config);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // Lazy load modules on first use
  if (!automodModule) automodModule = require("./features/automod");
  if (!ticketEnhancementsModule) ticketEnhancementsModule = require("./features/ticketEnhancements");
  if (!ticketsModule) ticketsModule = require("./features/tickets_v2");
  if (!staffTrackingModule) staffTrackingModule = require("./features/staffTracking_v2");
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
  if (!dropSyncModule) dropSyncModule = require("./features/dropSync");

  // Auto-moderation processing (runs first to catch violations)
  await automodModule.processMessage(message, config, CONFIG_PATH, data);

  // Update ticket activity tracking
  ticketEnhancementsModule.updateTicketActivity(message.channel.id, data, DATA_PATH);

  // Track staff activity
  if (message.member && hasStaffRole(message.member, config)) {
    staffTrackingModule.incStaffActivity(message.author.id, data, DATA_PATH);
  }

  // Log messages in tickets for transcripts
  ticketsModule.logTicketMessage(message, data, DATA_PATH);

  // Cache message for audit logging (only if enabled)
  if (config.audit_log_channel_id) {
    auditLogsModule.cacheMessage(message, data, DATA_PATH);
  }

  // Real-time drop notifications via WebSocket
  if (config.drops_channel_id && message.channel.id === config.drops_channel_id) {
    // Check if message has .txt attachments
    const txtAttachment = message.attachments.find(att =>
      att.name && att.name.toLowerCase().endsWith('.txt')
    );

    if (txtAttachment) {
      // Parse drop data from message
      let title = txtAttachment.name.replace('.txt', '');
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

      const dropData = {
        id: message.id,
        attachmentId: txtAttachment.id,
        title: title,
        description: description,
        type: 'account',
        fileName: txtAttachment.name,
        fileSize: txtAttachment.size,
        createdAt: message.createdAt.toISOString(),
        source: 'discord'
      };

      // Emit to all connected WebSocket clients
      const io = app.locals.io;
      if (io) {
        io.emit('dropAdded', dropData);
        console.log(`🔔 WebSocket: Emitted dropAdded event for "${title}"`);
      }
    }
  }
});

// Welcome messages and verification
client.on("guildMemberAdd", async (member) => {
  if (!welcomeModule) welcomeModule = require("./features/welcome");
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
  if (!verificationModule) verificationModule = require("./features/verification");

  await welcomeModule.sendWelcomeMessage(member, config);
  await auditLogsModule.logMemberJoin(member, config);

  // Handle verification system for new members
  await verificationModule.handleMemberJoin(member, config, data, DATA_PATH);
});

// Leave messages and member backup
client.on("guildMemberRemove", async (member) => {
  if (!welcomeModule) welcomeModule = require("./features/welcome");
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
  if (!verificationModule) verificationModule = require("./features/verification");

  await welcomeModule.sendLeaveMessage(member, config);
  await auditLogsModule.logMemberLeave(member, config);

  // Backup member data for restoration when they rejoin
  await verificationModule.handleMemberLeave(member, config, data, DATA_PATH);
});

// Member updates (boost tracking and role changes)
client.on("guildMemberUpdate", async (before, after) => {
  if (!boostTrackingModule) boostTrackingModule = require("./features/boostTracking");
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");

  // Boost tracking
  const boosterRoleId = config.booster_role_id;
  const boosterRole = boosterRoleId ? after.guild.roles.cache.get(boosterRoleId) : null;

  const beforeBoost = Boolean(before.premiumSince);
  const afterBoost = Boolean(after.premiumSince);

  if (!beforeBoost && afterBoost) {
    boostTrackingModule.addBoostLog(after.id, "boost_start", data, DATA_PATH);
    if (boosterRole && !after.roles.cache.has(boosterRoleId)) {
      await after.roles.add(boosterRole, "Auto-manage boost role (gained)").catch(console.error);
    }
  } else if (beforeBoost && !afterBoost) {
    boostTrackingModule.addBoostLog(after.id, "boost_end", data, DATA_PATH);
    if (boosterRole && after.roles.cache.has(boosterRoleId)) {
      await after.roles.remove(boosterRole, "Auto-manage boost role (lost)").catch(console.error);
    }
  }

  // Log role changes
  await auditLogsModule.logRoleUpdate(before, after, config);
});

// Message delete logging (only if enabled)
client.on("messageDelete", async (message) => {
  if (config.audit_log_channel_id) {
    if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
    await auditLogsModule.logMessageDelete(message, config, data);
  }
});

// Message edit logging (only if enabled)
client.on("messageUpdate", async (before, after) => {
  if (config.audit_log_channel_id) {
    if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
    await auditLogsModule.logMessageEdit(before, after, config);
  }
});

// Interaction handler
client.on("interactionCreate", async (interaction) => {
  try {
    await handleInteraction(interaction, config, data, CONFIG_PATH, DATA_PATH, interaction.client.io);
  } catch (error) {
    console.error("Error handling interaction:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred while processing your command.",
        ephemeral: true,
      }).catch(console.error);
    }
  }
});

// Handle errors
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

// Start the bot
(async () => {
  try {
    await registerCommands();
    await client.login(config.token);
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
})();

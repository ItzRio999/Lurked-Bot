// Load environment variables first
require("dotenv").config();

const { Client, GatewayIntentBits, Partials, REST, Routes, ActivityType, MessageFlags } = require("discord.js");
const { loadJson, saveJson, CONFIG_PATH, DATA_PATH } = require("./utils/fileManager");
const { handleInteraction } = require("./handlers/interactions");
const commands = require("./handlers/commands");
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { securityHeaders } = require('./middleware/securityHeaders');
const { generalLimiter } = require('./middleware/rateLimiter');
const { upsertServerAd } = require("./features/serverAd");

// Lazy-load feature modules (loaded on-demand for better memory efficiency on Pi)
let ticketsModule;
let welcomeModule, auditLogsModule, pollsModule, giveawaysModule, automodModule, ticketEnhancementsModule;
let verificationModule, dropSyncModule, inviteTrackingModule, timedRolesModule;
let securityTrapModule;

// In-memory invite cache for tracking which invite a new member used
let inviteCache = new Map();

// Debounce timer for sticky message reposting
let stickyDebounceTimer = null;
const BOT_CMDS_CHANNEL_ID = '1454672993740521493';

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
  tickets: {},
  ticket_counter: 0,
  closed_tickets: [],
  polls: {},
  message_cache: {},
  automod_strikes: {},
  giveaways: {},
  invite_tracking: { inviters: {}, joins: {} },
  timed_roles: [],
  vouches: [],
  vouch_counter: 0,
  movie_requests: [],
  movie_request_counter: 0,
  security_trap_stats: { auto_bans: 0, manual_bans: 0, bot_start_time: null, longest_uptime_ms: 0 },
  security_trap_cases: []
});

// Ensure security_trap_stats exists on older data files
if (!data.security_trap_stats) {
  data.security_trap_stats = { auto_bans: 0, manual_bans: 0, bot_start_time: null, longest_uptime_ms: 0 };
}
if (!Array.isArray(data.security_trap_cases)) {
  data.security_trap_cases = [];
}
if (!Array.isArray(data.movie_requests)) {
  data.movie_requests = [];
}
if (!Number.isInteger(data.movie_request_counter)) {
  data.movie_request_counter = 0;
}

// Initialize Discord client with optimizations for Raspberry Pi
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences, // For member status tracking
    GatewayIntentBits.GuildInvites, // For invite link tracking
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

// Trust proxy - required when behind Cloudflare Tunnel or reverse proxy
// Trust only the first proxy hop (Cloudflare) for security
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);

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

// Security middleware
app.use(securityHeaders); // Add HTTP security headers
app.use(generalLimiter);  // Rate limiting for all routes

// Make Discord client, config, data, and Socket.IO available to routes
app.locals.client = client;
app.locals.config = config;
app.locals.data = data;
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

  // Load Discord OAuth API routes
  const discordOAuthAPI = require('./api/discordOAuthAPI');
  app.use('/api/oauth', discordOAuthAPI);
  console.log('✅ Discord OAuth API routes loaded');

  // Load Bot Config API routes
  const botConfigAPI = require('./api/botConfigAPI');
  app.use('/api/bot', botConfigAPI);
  console.log('✅ Bot Config API routes loaded');

  // Load Stats API routes
  const statsAPI = require('./api/statsAPI');
  app.use('/api/bot', statsAPI);
  console.log('✅ Stats API routes loaded');

  // Load Tickets API routes
  const ticketsAPI = require('./api/ticketsAPI');
  app.use('/api/bot', ticketsAPI);
  console.log('✅ Tickets API routes loaded');

  // Load Tweaks API routes
  const tweaksAPI = require('./api/tweaksAPI');
  app.use('/api', tweaksAPI);
  console.log('✅ Tweaks API routes loaded');

  // Load Giveaways API routes
  const giveawaysAPI = require('./api/giveawaysAPI');
  app.use('/api', giveawaysAPI);
  console.log('✅ Giveaways API routes loaded');

  // Load Forums API routes
  const forumsAPI = require('./api/forumsAPI');
  app.use('/api', forumsAPI);
  console.log('✅ Forums API routes loaded');

  // Load Vouches API routes
  const vouchesAPI = require('./api/vouchesAPI');
  app.use('/api', vouchesAPI);
  console.log('✅ Vouches API routes loaded');

  // Load Admin Verification API routes
  const adminVerificationAPI = require('./api/adminVerificationAPI');
  app.use('/api/admin/verification', adminVerificationAPI);
  console.log('✅ Admin Verification API routes loaded');

  // Load Auth API routes
  const authAPI = require('./api/authAPI');
  app.use('/api', authAPI);
  console.log('Auth API routes loaded');

  // Log all registered routes for debugging
  console.log('\n📍 Registered API routes:');
  if (app._router && app._router.stack) {
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
  } else {
    console.log('  ℹ️ Router stack not available for route debugging');
  }
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
        'GET /api/team',
        'GET /api/tweaks/info',
        'GET /api/tweaks/download',
        'POST /api/tweaks/upload'
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

  // Cache guild invites for invite tracking
  try {
    inviteTrackingModule = require("./features/inviteTracking");
    for (const guild of client.guilds.cache.values()) {
      const guildInvites = await inviteTrackingModule.cacheInvites(guild);
      inviteCache.set(guild.id, guildInvites);
      console.log(`📨 Cached ${guildInvites.size} invites from ${guild.name}`);
    }
  } catch (error) {
    console.error('⚠️ Error caching invites:', error);
  }

  // Enhanced rotating status messages with Rich Presence
  const statuses = [
    { name: "for spam traps 🛡️", type: ActivityType.Watching, state: "Security Trap Online" },
    { name: "the do-not-type channel 👀", type: ActivityType.Watching, state: "Trap Monitoring" },
    { name: "for @everyone abuse 🚨", type: ActivityType.Watching, state: "Compromise Detection" },
    { name: "security reviews 🔍", type: ActivityType.Watching, state: "Manual Review Queue" },
    { name: "scammers get caught 🎯", type: ActivityType.Playing, state: "Trap Active" },
    { name: "cleanup after raids 🧹", type: ActivityType.Playing, state: "Server Defense" },
    { name: "for bad words 🛡️", type: ActivityType.Watching, state: "Auto-Moderation" },
    { name: "your support tickets <:ticket:1523383014648840273>", type: ActivityType.Watching, state: "Managing Tickets" },
    { name: "to /help ❓", type: ActivityType.Listening, state: "Ready to Assist" },
    { name: `${client.guilds.cache.size} server${client.guilds.cache.size !== 1 ? 's' : ''} 🌐`, type: ActivityType.Watching, state: "Multi-Server" },
    { name: "Made by sxloar <3", type: ActivityType.Playing, state: "Creator Credit" },
    { name: "Developed by sxloar <3", type: ActivityType.Playing, state: "Built with Care" },
    { name: "security first 🔐", type: ActivityType.Playing, state: "Protection Mode" },
    { name: "raid prevention mode ⚔️", type: ActivityType.Playing, state: "Defense Ready" },
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

  // Check for expired timed roles every 60 seconds
  timedRolesModule = require("./features/timedRoles");
  setInterval(() => {
    timedRolesModule.checkTimedRoles(client, data, DATA_PATH, config);
  }, 60000);

  // Initial timed roles check
  timedRolesModule.checkTimedRoles(client, data, DATA_PATH, config);

  // Ensure protected security channel only contains the warning embed
  if (!securityTrapModule) securityTrapModule = require("./features/securityTrap");
  securityTrapModule.initSecurityTrap(data, config);
  data.security_trap_stats.bot_start_time = Date.now();
  saveJson(DATA_PATH, data);
  await securityTrapModule.ensureSecurityTrapNotice(client);
  setInterval(() => {
    securityTrapModule.ensureSecurityTrapNotice(client).catch(console.error);
  }, 30000);

  if (data.server_ad_channel_id && data.server_ad_message_id) {
    const serverAdChannel = await client.channels
      .fetch(data.server_ad_channel_id)
      .catch(() => null);

    if (serverAdChannel && serverAdChannel.isTextBased()) {
      await upsertServerAd({
        channel: serverAdChannel,
        client,
        config,
        data,
        dataPath: DATA_PATH,
      }).catch((error) => {
        console.error("Error refreshing server ad:", error);
      });
    }
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  if (!securityTrapModule) {
    securityTrapModule = require("./features/securityTrap");
    securityTrapModule.initSecurityTrap(data, config);
  }
  const handledBySecurityTrap = await securityTrapModule.handleSecurityTrapMessage(message, config);
  if (handledBySecurityTrap) return;

  // Sticky message: keep the info embed pinned to the bottom of bot-cmds
  if (message.channel.id === BOT_CMDS_CHANNEL_ID) {
    if (stickyDebounceTimer) clearTimeout(stickyDebounceTimer);
    stickyDebounceTimer = setTimeout(async () => {
      try {
        const { EmbedBuilder } = require('discord.js');
        const { addLogo } = require('./utils/fileManager');

        // Delete previous sticky message if tracked
        if (data.sticky_message_id) {
          const oldMsg = await message.channel.messages.fetch(data.sticky_message_id).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
          data.sticky_message_id = null;
        }

        // Build and send fresh sticky
        const embed = addLogo(
          new EmbedBuilder()
            .setTitle('📋  Bot Commands')
            .setColor(0x5865F2)
            .setDescription(
              'All user commands must be run **in this channel**. Using them elsewhere will redirect you back here.\n\u200b'
            )
            .addFields(
              {
                name: '⭐  /vouch — Submit a Review',
                value: [
                  'Leave a public review for our server. Helps the community grow.',
                  '```',
                  '/vouch message: stars: proof:',
                  '```',
                  '`message` — Your written review *(required)*',
                  '`stars` — Rating from **1 to 5** *(required)*',
                  '`proof` — Image or video attachment *(optional)*',
                  '\u200b',
                ].join('\n'),
                inline: false
              },
              {
                name: '🎬  /requestmovie — Movie Night Requests',
                value: [
                  'Submit a film for consideration at our next movie night.',
                  '```',
                  '/requestmovie title: year: details: link:',
                  '```',
                  '`title` — Movie name *(required)*',
                  '`year` — Release year *(required)*',
                  '`details` — Why you want it hosted *(optional)*',
                  '`link` — IMDb / TMDb / trailer URL *(optional)*',
                  '\u200b',
                ].join('\n'),
                inline: false
              },
              {
                name: '🔗  How to Get a Movie Link',
                value: [
                  'Search your movie on **[IMDb](https://www.imdb.com)** or **[TMDb](https://www.themoviedb.org)**, then copy the URL from your browser and paste it into the `link` field.',
                  '',
                  '> \u2705  Requests that include a valid link are **significantly more likely to be accepted** \u2014 it helps staff identify the exact film quickly.',
                  '\u200b',
                ].join('\n'),
                inline: false
              },
              {
                name: '👤  /userinfo',
                value: '```\n/userinfo user:\n```\nView info about yourself or any member.',
                inline: true
              },
              {
                name: '📨  /invites',
                value: '```\n/invites user:\n```\nCheck your invite count and stats.',
                inline: true
              },
              {
                name: '❓  /help',
                value: '```\n/help\n```\nView all available bot commands.',
                inline: true
              }
            )
            .setFooter({ text: 'Commands are restricted to this channel  \u2022  Last refreshed' })
            .setTimestamp(),
          config
        );

        const sent = await message.channel.send({ embeds: [embed] });
        data.sticky_message_id = sent.id;
        saveJson(DATA_PATH, data);
      } catch (err) {
        console.error('⚠️ Error updating sticky message:', err);
      }
    }, 1500);
  }

  // Lazy load modules on first use
  if (!automodModule) automodModule = require("./features/automod");
  if (!ticketEnhancementsModule) ticketEnhancementsModule = require("./features/ticketEnhancements");
  if (!ticketsModule) ticketsModule = require("./features/tickets_v2");
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");
  if (!dropSyncModule) dropSyncModule = require("./features/dropSync");

  // Auto-moderation processing (runs first to catch violations)
  await automodModule.processMessage(message, config, CONFIG_PATH, data);

  // Update ticket activity tracking
  ticketEnhancementsModule.updateTicketActivity(message.channel.id, data, DATA_PATH);

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

  // Track which invite was used
  if (!inviteTrackingModule) inviteTrackingModule = require("./features/inviteTracking");
  try {
    const guildCache = inviteCache.get(member.guild.id) || new Map();
    const updatedCache = await inviteTrackingModule.handleMemberJoin(member, guildCache, data, DATA_PATH);
    inviteCache.set(member.guild.id, updatedCache);
  } catch (error) {
    console.error("⚠️ Error tracking invite:", error);
  }

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

// Member updates (role changes)
client.on("guildMemberUpdate", async (before, after) => {
  if (!auditLogsModule) auditLogsModule = require("./features/auditLogs");

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

// Keep invite cache fresh when invites are created or deleted
client.on("inviteCreate", async (invite) => {
  if (!invite.guild) return;
  if (!inviteTrackingModule) inviteTrackingModule = require("./features/inviteTracking");
  const updatedCache = await inviteTrackingModule.cacheInvites(invite.guild);
  inviteCache.set(invite.guild.id, updatedCache);
});

client.on("inviteDelete", async (invite) => {
  if (!invite.guild) return;
  if (!inviteTrackingModule) inviteTrackingModule = require("./features/inviteTracking");
  const updatedCache = await inviteTrackingModule.cacheInvites(invite.guild);
  inviteCache.set(invite.guild.id, updatedCache);
});

// Interaction handler
client.on("interactionCreate", async (interaction) => {
  try {
    await handleInteraction(interaction, config, data, CONFIG_PATH, DATA_PATH, interaction.client.io);

    // Sticky message: repost after slash commands in bot-cmds channel
    if (interaction.isChatInputCommand() && interaction.channelId === BOT_CMDS_CHANNEL_ID) {
      if (stickyDebounceTimer) clearTimeout(stickyDebounceTimer);
      stickyDebounceTimer = setTimeout(async () => {
        try {
          const channel = interaction.channel || await interaction.client.channels.fetch(BOT_CMDS_CHANNEL_ID).catch(() => null);
          if (!channel) return;
          const { EmbedBuilder } = require('discord.js');
          const { addLogo } = require('./utils/fileManager');
          if (data.sticky_message_id) {
            const oldMsg = await channel.messages.fetch(data.sticky_message_id).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => {});
            data.sticky_message_id = null;
          }
          const embed = addLogo(
            new EmbedBuilder()
              .setTitle('📋  Bot Commands')
              .setColor(0x5865F2)
              .setDescription('All user commands must be run **in this channel**. Using them elsewhere will redirect you back here.\n\u200b')
              .addFields(
                { name: '⭐  /vouch — Submit a Review', value: ['Leave a public review for our server. Helps the community grow.', '```', '/vouch message: stars: proof:', '```', '`message` — Your written review *(required)*', '`stars` — Rating from **1 to 5** *(required)*', '`proof` — Image or video attachment *(optional)*', '\u200b'].join('\n'), inline: false },
                { name: '🎬  /requestmovie — Movie Night Requests', value: ['Submit a film for consideration at our next movie night.', '```', '/requestmovie title: year: details: link:', '```', '`title` — Movie name *(required)*', '`year` — Release year *(required)*', '`details` — Why you want it hosted *(optional)*', '`link` — IMDb / TMDb / trailer URL *(optional)*', '\u200b'].join('\n'), inline: false },
                { name: '🔗  How to Get a Movie Link', value: ['Search your movie on **[IMDb](https://www.imdb.com)** or **[TMDb](https://www.themoviedb.org)**, then copy the URL from your browser and paste it into the `link` field.', '', '> \u2705  Requests that include a valid link are **significantly more likely to be accepted** \u2014 it helps staff identify the exact film quickly.', '\u200b'].join('\n'), inline: false },
                { name: '👤  /userinfo', value: '```\n/userinfo user:\n```\nView info about yourself or any member.', inline: true },
                { name: '📨  /invites', value: '```\n/invites user:\n```\nCheck your invite count and stats.', inline: true },
                { name: '❓  /help', value: '```\n/help\n```\nView all available bot commands.', inline: true }
              )
              .setFooter({ text: 'Commands are restricted to this channel  \u2022  Last refreshed' })
              .setTimestamp(),
            config
          );
          const sent = await channel.send({ embeds: [embed] });
          data.sticky_message_id = sent.id;
          saveJson(DATA_PATH, data);
        } catch (err) {
          console.error('⚠️ Error updating sticky message after interaction:', err);
        }
      }, 1500);
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
    const msg = { content: "❌ An error occurred while processing your command.", flags: MessageFlags.Ephemeral };
    const interactionAgeMs = Date.now() - interaction.createdTimestamp;
    if (!interaction.replied && !interaction.deferred && interactionAgeMs < 2500) {
      await interaction.reply(msg).catch(() => {});
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
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

  // Stop stat counter updates
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

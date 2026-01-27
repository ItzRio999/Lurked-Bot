# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing a Discord community platform with two main components:

1. **React/Vite Frontend** (`src/`) - Web application for community features
2. **Discord Bot Backend** (`discordbot/LurkedAccounts/`) - Node.js bot with Express API

The platform provides account drops, forums, team showcase, and Discord bot management features.

## Development Commands

### Frontend (React/Vite)
```bash
# Install dependencies
npm install

# Start dev server (default: http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend (Discord Bot)
```bash
cd discordbot/LurkedAccounts

# Install dependencies
npm install

# Start the bot (includes Express API server)
npm start

# Run with PM2 for production
pm2 start index.js --name lurked-bot
pm2 logs lurked-bot
```

## Architecture Overview

### Communication Flow

```
Frontend (React) <--WebSocket--> Express API <--> Discord Bot
                 <--REST API-->
                 <--Firebase Auth-->
```

1. **Frontend** connects to Express API (`VITE_FILE_SERVER_URL`, default `http://localhost:3002`)
2. **Express API** runs alongside Discord bot in `discordbot/LurkedAccounts/index.js`
3. **Real-time updates** via Socket.io when drops are added/deleted
4. **Authentication** via Firebase Auth - admins verified against Firestore `settings/admins`

### Key Integration Points

**Drops System:**
- Discord bot monitors `drops_channel_id` for `.txt` file attachments
- Files are stored in Discord, metadata exposed via `/api/drops` endpoint
- Real-time WebSocket events (`dropAdded`, `dropDeleted`) notify frontend instantly
- Admin uploads via `/api/upload-drop` post directly to Discord channel

**Team Showcase:**
- Discord bot fetches guild members on startup
- Exposed via `/api/team` endpoint
- Frontend displays team members with avatars and roles

**Admin Authentication:**
- Firebase ID token sent in `Authorization: Bearer <token>` header
- Backend verifies token with Firebase Admin SDK
- Admin status checked against Firestore `settings/admins.emails` array
- Protected endpoints: `POST /api/upload-drop`, `DELETE /api/drop/:dropId`

### Directory Structure

```
├── src/                          # React frontend
│   ├── components/
│   │   ├── sections/            # Page components (HomePage, ForumsPage, etc.)
│   │   ├── modals/              # Modal components (AuthModal)
│   │   ├── layout/              # Layout components (NavBar, Footer)
│   │   └── ui/                  # Reusable UI components
│   ├── lib/
│   │   └── firebase.js          # Firebase config & initialization
│   ├── utils/                   # Utility functions
│   ├── data/                    # Static data and constants
│   └── App.jsx                  # Main app component (1500+ lines, state management hub)
│
├── discordbot/LurkedAccounts/   # Discord bot backend
│   ├── index.js                 # Main bot entry point & Express API server
│   ├── features/                # Bot feature modules (lazy-loaded)
│   │   ├── tickets_v2.js       # Ticket system
│   │   ├── staffTracking_v2.js # Staff activity tracking
│   │   ├── boostTracking.js    # Server boost tracking
│   │   ├── polls.js            # Poll system
│   │   ├── giveaways.js        # Giveaway system
│   │   ├── automod.js          # Auto-moderation
│   │   └── welcome.js          # Welcome/leave messages
│   ├── handlers/
│   │   ├── commands.js         # Slash command definitions
│   │   └── interactions.js     # Interaction handler
│   ├── api/
│   │   ├── dropsAPI.js         # Drops endpoints (GET /api/drops, POST /api/upload-drop, etc.)
│   │   └── teamAPI.js          # Team endpoints (GET /api/team)
│   ├── middleware/
│   │   └── firebaseAuth.js     # Firebase authentication middleware
│   └── utils/                  # Utility functions
```

## Configuration Files

**Frontend Environment (`.env`):**
- `VITE_FILE_SERVER_URL` - Discord bot API URL (default: `http://localhost:3002`)

**Backend Configuration:**
- `.env` - Environment variables (Discord token, API ports, CORS origins)
- `config.json` - Bot settings (channel IDs, role IDs, feature configurations)
- `serviceAccount.json` - Firebase Admin SDK credentials (NEVER commit!)
- `data.json` - Runtime data (auto-generated, contains staff activity, tickets, etc.)

See `discordbot/LurkedAccounts/README_SETUP.md` for detailed setup instructions.

## Common Development Workflows

### Adding a New Frontend Page

1. Create page component in `src/components/sections/`
2. Add route to `navItems` in `src/data/appData.js`
3. Add page label to `pageLabels` in `src/data/appData.js`
4. Import and render in `App.jsx`
5. Add navigation logic in `handleNav` function

### Adding a New Discord Bot Feature

1. Create feature module in `discordbot/LurkedAccounts/features/`
2. Lazy-load module in `index.js` (for memory efficiency on Raspberry Pi)
3. Register event handlers in appropriate `client.on()` blocks
4. Add slash commands to `handlers/commands.js` if needed
5. Handle interactions in `handlers/interactions.js`

### Adding a New API Endpoint

1. Create or modify file in `discordbot/LurkedAccounts/api/`
2. Use `verifyFirebaseToken` middleware for protected routes
3. Access Discord client via `req.app.locals.client`
4. Access bot config via `req.app.locals.config`
5. Emit Socket.io events via `req.app.locals.io` for real-time updates
6. Register routes in `index.js` after `clientReady` event

## Firebase Structure

**Collections:**
- `threads` - Forum threads
  - `threads/{threadId}/replies` - Thread replies
- `adminLogs` - Admin action audit logs
- `settings/admins` - Admin email list (used for authentication)

**Authentication:**
- Firebase Auth for user accounts
- Email verification required for community access
- Admin status checked via Firestore `settings/admins.emails` array

## Performance Considerations

**Frontend:**
- Lazy loading for large components
- Real-time updates via WebSocket to reduce polling
- Firestore real-time listeners with limits (e.g., `limit(8)` for threads)

**Backend (Optimized for Raspberry Pi):**
- Lazy-loaded feature modules (loaded on first use)
- Memory sweepers configured for low-memory devices
- Reduced polling intervals (2 hours for inactive tickets vs 1 hour)
- Batch operations for Firestore writes (max 450 operations per batch)

## Bot Command Registration

Commands are automatically registered on bot startup:
- Guild commands if `guild_ids` array is provided in `config.json`
- Global commands if no guilds specified
- Supports multiple guilds via `guild_ids` array

## Testing

**Frontend:**
- Start dev server: `npm run dev`
- Test Firebase Auth, Firestore operations, Socket.io connections
- Verify admin features require admin email in Firestore

**Backend:**
- Check console for initialization messages
- Test slash commands in Discord
- Test API endpoints with authenticated requests
- Monitor PM2 logs: `pm2 logs lurked-bot`

## Security Notes

- Firebase credentials in `src/lib/firebase.js` are **public** (client-side)
- Backend Firebase Admin SDK credentials in `serviceAccount.json` are **private**
- Protected API endpoints verify Firebase ID tokens server-side
- CORS configured via `API_CORS_ORIGIN` environment variable
- Discord bot token stored in `.env` (never hardcode in `config.json`)

## Deployment

**Frontend:**
```bash
npm run build
# Deploy `dist/` folder to hosting (Firebase Hosting, Netlify, etc.)
```

**Backend:**
```bash
cd discordbot/LurkedAccounts
pm2 start index.js --name lurked-bot
pm2 startup  # Enable auto-start on reboot
pm2 save
```

Update environment variables:
- Frontend: Set `VITE_FILE_SERVER_URL` to production API URL
- Backend: Update `API_CORS_ORIGIN` with production frontend URLs
- Backend: Update `oauth.redirect_uri` in `config.json` for Discord OAuth

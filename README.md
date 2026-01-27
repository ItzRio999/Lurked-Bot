# LurkedAccounts Discord Bot

Discord bot for the LurkedAccounts community platform. Built with Discord.js v14 and Express.js.

## Features

- **Account Drops System** - Automated account drop notifications with real-time sync
- **Verification System** - CAPTCHA-based verification with security logging
- **Ticket System** - Support ticket management with auto-close
- **Staff Tracking** - Activity monitoring for staff members
- **Boost Tracking** - Server boost rewards and logging
- **Polls & Giveaways** - Interactive community engagement
- **Auto-moderation** - Spam, caps, links, and bad word filtering
- **Express API** - REST API with Socket.io for real-time updates

## Setup

See [discordbot/LurkedAccounts/README_SETUP.md](discordbot/LurkedAccounts/README_SETUP.md) for detailed setup instructions.

### Quick Start

```bash
cd discordbot/LurkedAccounts

# Copy example files
cp .env.example .env
cp config.example.json config.json

# Install dependencies
npm install

# Configure your .env and config.json files

# Start the bot
npm start
```

### Production Deployment

```bash
cd discordbot/LurkedAccounts
pm2 start index.js --name lurked
pm2 save
pm2 startup
```

## Configuration

- `.env` - Environment variables (Discord token, API settings)
- `config.json` - Bot configuration (channel IDs, role IDs, features)
- `serviceAccount.json` - Firebase Admin SDK credentials (create from `serviceAccount.example.json`)

## API Endpoints

- `GET /api/drops` - Get all account drops
- `POST /api/upload-drop` - Upload new drop (admin only)
- `DELETE /api/drop/:id` - Delete a drop (admin only)
- `GET /api/team` - Get team members
- `GET /api/events` - Get upcoming events

## Tech Stack

- **Discord.js** v14 - Discord bot framework
- **Express.js** - Web server
- **Socket.io** - Real-time WebSocket communication
- **Firebase Admin** - Authentication and Firestore database
- **Multer** - File upload handling

## License

Private - LurkedAccounts © 2026

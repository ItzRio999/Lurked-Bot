# Lurked Bot - Setup Instructions

This guide will help you set up the Lurked Bot on your Raspberry Pi after pulling from GitHub.

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ItzRio999/Lurked-Bot.git
cd Lurked-Bot/discordbot/LurkedAccounts
```

### 2. Install Dependencies

```bash
npm install
```

---

## 🔐 Configuration Files Setup

You need to create 3 configuration files from the provided templates:

### Step 1: Create `.env` File

```bash
cp .env.example .env
nano .env
```

**Fill in these values:**

| Variable | Where to Get It | Example |
|----------|----------------|---------|
| `DISCORD_TOKEN` | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token | `MTQ1Mjg1MTYw...` |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal → Your App → OAuth2 → Client Secret | `k6MQA8lpoX...` |
| `OAUTH_REDIRECT_URI` | Your domain + `/auth/discord/callback` | `http://your-pi-ip:3000/auth/discord/callback` |
| `WEB_SERVER_PORT` | OAuth callback server port (default: 3000) | `3000` |
| `API_PORT` | API server port for file uploads (default: 3002) | `3002` |
| `API_CORS_ORIGIN` | Your website URLs (comma-separated) | `http://localhost:5173,https://yourdomain.com` |

**Example `.env`:**
```env
DISCORD_TOKEN=MTQ1Mjg1MTYw...your_token_here
DISCORD_CLIENT_SECRET=k6MQA8lp...your_secret_here
OAUTH_REDIRECT_URI=http://192.168.1.100:3000/auth/discord/callback
WEB_SERVER_PORT=3000
API_PORT=3002
API_CORS_ORIGIN=http://localhost:5173,https://yourdomain.com
```

---

### Step 2: Create `config.json` File

```bash
cp config.example.json config.json
nano config.json
```

**What to fill in:**

1. **`client_id`**: Your Discord Application ID (from Developer Portal)
2. **`guild_ids`**: Array of Discord server IDs where the bot operates
3. **`owner_user_ids`**: Array of Discord user IDs who are bot owners
4. **Role IDs**: Replace all `YOUR_*_ROLE_ID` with actual Discord role IDs
5. **Channel IDs**: Replace all `YOUR_*_CHANNEL_ID` with actual Discord channel IDs
6. **`drops_channel_id`**: Channel where account drops are posted (**IMPORTANT for file uploads**)
7. **`logo_url`**: Your server's logo image URL

**How to get Discord IDs:**
1. Enable Developer Mode in Discord: User Settings → Advanced → Developer Mode
2. Right-click on channels/roles/users → Copy ID

---

### Step 3: Create `serviceAccount.json` File (Firebase Credentials)

```bash
cp serviceAccount.example.json serviceAccount.json
nano serviceAccount.json
```

**Where to get this file:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → Project Settings
4. Go to "Service Accounts" tab
5. Click "Generate New Private Key"
6. Download the JSON file
7. Copy the contents into `serviceAccount.json`

**⚠️ CRITICAL:** This file contains sensitive credentials. Never commit it to Git!

---

## 🔒 Security Implementation

This bot now includes **Firebase Authentication** for API endpoints:

### What Was Added:
- **Token verification middleware** at `middleware/firebaseAuth.js`
- **Protected endpoints:**
  - `POST /api/upload-drop` - Requires authenticated admin
  - `DELETE /api/drop/:dropId` - Requires authenticated admin

### How It Works:
1. Frontend sends Firebase ID token in `Authorization: Bearer <token>` header
2. Backend verifies token with Firebase Admin SDK
3. Backend checks if user's email is in Firestore `settings/admins` document
4. Only authenticated admins can upload/delete drops

### First-Time Setup:
After starting the bot, you need to add admin emails to Firestore:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Firestore Database
3. Create a collection: `settings`
4. Create a document with ID: `admins`
5. Add a field: `emails` (type: array)
6. Add your admin email(s) to the array

**Example:**
```
Collection: settings
Document ID: admins
Field: emails = ["admin@example.com", "owner@example.com"]
```

---

## 📁 Optional: Restore Existing Data

If you have backups of your bot's data:

```bash
# Copy your existing data.json (contains staff activity, user data)
cp /path/to/backup/data.json ./data.json
```

---

## 🚀 Running the Bot

### Start the bot:
```bash
npm start
```

### Expected console output:
```
✅ Firebase Admin SDK initialized successfully
🤖 Bot is online!
🌐 API server running on port 3002
```

### Run in background (with PM2):
```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start index.js --name lurked-bot

# View logs
pm2 logs lurked-bot

# Auto-restart on boot
pm2 startup
pm2 save
```

---

## 🧪 Testing the Setup

### 1. Test Bot Connection
- Check if bot appears online in Discord
- Try a test command

### 2. Test API Security
From your website:
- **As admin:** Try uploading a drop → Should work ✅
- **As admin:** Try deleting a drop → Should work ✅
- **As regular user:** Try uploading → Should get "Admin access required" error ❌

### 3. Check Console Logs
Look for:
- `✅ Firebase Admin SDK initialized successfully`
- `✅ Drop posted to Discord: "Test Drop"`
- `⚠️ Non-admin user attempted admin action: user@example.com` (if non-admin tries)

---

## 🔧 Troubleshooting

### Error: "Firebase authentication not configured"
**Solution:** Make sure `serviceAccount.json` exists and is valid

### Error: "Discord bot not ready"
**Solution:** Check your `DISCORD_TOKEN` in `.env` is correct

### Error: "Drops channel not found"
**Solution:** Set correct `drops_channel_id` in `config.json`

### File uploads not working
**Solution:** Ensure `API_CORS_ORIGIN` in `.env` includes your website URL

### Admin can't upload drops
**Solution:**
1. Check Firestore has `settings/admins` document with correct email
2. Email in Firestore must match the one you're logged in with
3. Check browser console for authentication errors

---

## 📋 Configuration Summary

| File | Purpose | Contains Secrets? |
|------|---------|-------------------|
| `.env` | Environment variables (tokens, ports) | ✅ YES |
| `config.json` | Bot configuration (IDs, settings) | ✅ YES |
| `serviceAccount.json` | Firebase Admin credentials | ✅ YES (CRITICAL) |
| `data.json` | Bot runtime data (auto-generated) | ⚠️ User data |

**⚠️ NEVER commit these files to Git! They are already in `.gitignore`**

---

## 🔐 Security Best Practices

1. **Keep credentials secure:** Never share `.env`, `config.json`, or `serviceAccount.json`
2. **Use strong tokens:** Regenerate Discord bot token if compromised
3. **Restrict API access:** Only add trusted admins to Firestore `settings/admins`
4. **Enable HTTPS:** Use SSL certificates for production (Let's Encrypt)
5. **Update dependencies:** Run `npm update` regularly for security patches

---

## 📞 Support

If you encounter issues:
1. Check console logs for error messages
2. Verify all configuration files are set up correctly
3. Ensure Firebase Admin SDK is initialized successfully
4. Check Discord Developer Portal for bot permissions

---

## 🎉 You're All Set!

Your bot is now fully configured with secure API authentication. Enjoy! 🚀

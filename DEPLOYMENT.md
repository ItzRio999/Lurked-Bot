# Deployment Guide

This project should be deployed as two separate pieces:

1. Frontend on Spaceship/cPanel
2. Discord bot + API on the Raspberry Pi

The frontend is a static Vite build. The bot exposes the API and Socket.IO server that the frontend uses.

## Recommended Production Layout

- Frontend: `https://lurkedaccounts.tech`
- Bot/API: `https://api.lurkedaccounts.tech`

Use a dedicated API subdomain for the Pi. That keeps OAuth, CORS, and WebSocket traffic simple and avoids trying to proxy Socket.IO through cPanel.

## 1. Frontend Deployment on cPanel

Build locally from the repo root:

```powershell
npm install
$env:VITE_FILE_SERVER_URL="https://api.lurkedaccounts.tech"
npm run build
```

Upload the contents of `dist/` to your cPanel document root, usually `public_html/`.

If your frontend is on a subdomain instead, use that URL consistently in the bot `.env`.

## 2. DNS Setup

Create DNS records for:

- `lurkedaccounts.tech` -> your Spaceship/cPanel site
- `api.lurkedaccounts.tech` -> proxied through Cloudflare Tunnel

The tunnel will publish the Pi's local API server without port forwarding.

## 3. Bot Environment on Raspberry Pi

On the Pi:

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Copy the bot folder to the Pi:

- `discordbot/LurkedAccounts`

Inside that folder:

```bash
npm install
cp .env.example .env
cp config.example.json config.json
```

You also need:

- `serviceAccount.json` in the bot root if you use Firebase-authenticated admin APIs
- `data.json` will be created automatically if missing for some features, but it is safer to keep backups

## 4. Production Values You Should Use

Frontend `.env` at repo root before building:

```env
VITE_FILE_SERVER_URL=https://api.lurkedaccounts.tech
```

Bot `.env` on the Pi:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://api.lurkedaccounts.tech/api/oauth/discord/callback
OAUTH_REDIRECT_URI=https://api.lurkedaccounts.tech/api/oauth/discord/callback
WEB_SERVER_PORT=3000
API_PORT=3002
API_CORS_ORIGIN=https://lurkedaccounts.tech,https://www.lurkedaccounts.tech
FRONTEND_URL=https://lurkedaccounts.tech
TMDB_API_KEY=...
```

Important notes:

- `DISCORD_REDIRECT_URI` must exactly match the redirect URI configured in the Discord Developer Portal.
- `API_CORS_ORIGIN` should only include the frontend origins that will access the API.
- The app uses Socket.IO, so the API hostname must support WebSockets. Cloudflare Tunnel does.

## 5. Discord Developer Portal Settings

In your Discord application:

- Add `https://api.lurkedaccounts.tech/api/oauth/discord/callback` as a redirect URI
- Confirm the bot has the required privileged intents enabled if you use member/presence/message features

This bot uses:

- Guild Members intent
- Message Content intent
- Presences intent

## 6. Cloudflare Tunnel on the Pi

Install `cloudflared` on the Pi, authenticate it, create a tunnel, and map `api.lurkedaccounts.tech` to local port `3002`.

Example config file: [`discordbot/LurkedAccounts/deploy/cloudflared-config.example.yml`](C:/Users/ItsRio'sPc/Desktop/desktopV2/web/discordbot/LurkedAccounts/deploy/cloudflared-config.example.yml)

High-level flow:

```bash
cloudflared tunnel login
cloudflared tunnel create lurked-bot
cloudflared tunnel route dns lurked-bot api.lurkedaccounts.tech
```

Then place your config at:

```bash
/etc/cloudflared/config.yml
```

Run it:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

## 7. Run the Bot as a Service

Use `systemd` on the Pi so the bot auto-starts on reboot.

Example service file: [`discordbot/LurkedAccounts/deploy/lurkedbot.service.example`](C:/Users/ItsRio'sPc/Desktop/desktopV2/web/discordbot/LurkedAccounts/deploy/lurkedbot.service.example)

Install it as:

```bash
sudo cp deploy/lurkedbot.service.example /etc/systemd/system/lurkedbot.service
sudo systemctl daemon-reload
sudo systemctl enable lurkedbot
sudo systemctl start lurkedbot
sudo systemctl status lurkedbot
```

Logs:

```bash
journalctl -u lurkedbot -f
```

## 8. Verification Checklist

Check local bot API on the Pi:

```bash
curl http://localhost:3002/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "message": "Discord bot API is running",
  "botReady": true
}
```

Then check the public tunnel URL:

```bash
curl https://api.lurkedaccounts.tech/api/health
```

Then load the website and confirm:

- drops list loads
- team page loads
- events load
- Discord OAuth login redirects correctly
- admin-only bot dashboard calls succeed after Firebase auth
- real-time updates work for drops/events

## 9. Common Failure Points

- Frontend built with the wrong `VITE_FILE_SERVER_URL`
- Discord OAuth redirect URI does not exactly match production
- `serviceAccount.json` missing on the Pi, which breaks Firebase-protected admin routes
- `API_CORS_ORIGIN` missing your real frontend domain
- Cloudflare tunnel DNS created for the wrong hostname
- Bot not starting because `config.json` was never copied from `config.example.json`
- Pi clock drift causing auth/session issues

## 10. Suggested Order

1. Get the bot working locally on the Pi with `curl http://localhost:3002/api/health`
2. Put Cloudflare Tunnel in front of it and test `https://api.lurkedaccounts.tech/api/health`
3. Build the frontend with `VITE_FILE_SERVER_URL=https://api.lurkedaccounts.tech`
4. Upload `dist/` to cPanel
5. Update Discord OAuth redirect URI to the API subdomain
6. Test login, API fetches, and WebSocket updates

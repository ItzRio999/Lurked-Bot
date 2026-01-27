const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyAuth } = require("../middleware/firebaseAuth");
const { authLimiter } = require("../middleware/rateLimiter");
const { createState, validateState } = require("../utils/oauthStateManager");

// Discord API endpoints
const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_OAUTH_BASE = "https://discord.com/oauth2";

// Required Discord server ID for verification
const REQUIRED_GUILD_ID = "1451251793303703614";

/**
 * GET /api/oauth/discord/authorize
 * Protected endpoint - generates Discord OAuth URL with state token
 */
router.get("/discord/authorize", authLimiter, verifyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ||
      process.env.OAUTH_REDIRECT_URI ||
      req.app.locals.config?.oauth?.redirect_uri;

    if (!redirectUri) {
      return res.status(500).json({
        success: false,
        error: "Missing Discord OAuth redirect URI",
      });
    }

    // Generate state token for CSRF protection
    const state = createState(firebaseUid);

    // Build Discord OAuth authorization URL
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || req.app.locals.config.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify guilds",
      state: state,
    });

    const authorizationUrl = `${DISCORD_OAUTH_BASE}/authorize?${params.toString()}`;

    res.json({
      success: true,
      authorizationUrl,
    });
  } catch (error) {
    console.error("Error generating Discord OAuth URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate authorization URL",
    });
  }
});

/**
 * GET /api/oauth/discord/callback
 * Public endpoint - handles Discord OAuth callback
 */
router.get("/discord/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    process.env.OAUTH_REDIRECT_URI ||
    req.app.locals.config?.oauth?.redirect_uri;

  try {
    // Handle user denial
    if (error === "access_denied") {
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=user_denied`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=missing_parameters`
      );
    }

    // Validate state token
    const stateValidation = validateState(state);
    if (!stateValidation.valid) {
      console.error("Invalid or expired state token");
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=invalid_state`
      );
    }

    const firebaseUid = stateValidation.firebaseUid;

    // Exchange code for access token
    if (!redirectUri) {
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=server_error`
      );
    }

    const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || req.app.locals.config.client_id,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Discord token exchange failed:", errorData);
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch Discord user info
    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch Discord user info");
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=fetch_user_failed`
      );
    }

    const discordUser = await userResponse.json();

    // Fetch user's guilds
    const guildsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!guildsResponse.ok) {
      console.error("Failed to fetch Discord guilds");
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=fetch_guilds_failed`
      );
    }

    const guilds = await guildsResponse.json();

    // Verify user is member of required Discord server
    const isMember = guilds.some((guild) => guild.id === REQUIRED_GUILD_ID);

    if (!isMember) {
      console.log(
        `User ${discordUser.username} is not a member of required server (${REQUIRED_GUILD_ID})`
      );
      return res.redirect(
        `${frontendUrl}/#settings?discord_linked=error&reason=not_in_server`
      );
    }

    // Build avatar URL
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${
          discordUser.avatar.startsWith("a_") ? "gif" : "png"
        }?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${
          discordUser.discriminator === "0"
            ? (BigInt(discordUser.id) >> 22n) % 6n
            : parseInt(discordUser.discriminator) % 5
        }.png`;

    // Store Discord profile in Firestore
    const discordProfile = {
      discordId: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator || "0",
      globalName: discordUser.global_name || discordUser.username,
      avatar: discordUser.avatar || null,
      avatarUrl: avatarUrl,
      guilds: guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        joined: true,
      })),
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin
      .firestore()
      .collection("users")
      .doc(firebaseUid)
      .collection("discord")
      .doc("profile")
      .set(discordProfile);

    // Log to admin logs
    await admin.firestore().collection("adminLogs").add({
      action: "discord_linked",
      details: `Discord account linked: @${discordUser.username} (${discordUser.id})`,
      userId: firebaseUid,
      discordId: discordUser.id,
      discordUsername: discordUser.username,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `✅ Discord account linked: ${discordUser.username} → Firebase UID: ${firebaseUid}`
    );

    // Redirect to frontend with success
    res.redirect(`${frontendUrl}/#settings?discord_linked=success`);
  } catch (error) {
    console.error("Error in Discord OAuth callback:", error);
    res.redirect(
      `${frontendUrl}/#settings?discord_linked=error&reason=server_error`
    );
  }
});

/**
 * POST /api/oauth/discord/unlink
 * Protected endpoint - unlinks Discord account
 */
router.post("/discord/unlink", authLimiter, verifyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;

    // Fetch current Discord profile for logging
    const profileDoc = await admin
      .firestore()
      .collection("users")
      .doc(firebaseUid)
      .collection("discord")
      .doc("profile")
      .get();

    const discordData = profileDoc.exists ? profileDoc.data() : null;

    // Delete Discord profile
    await admin
      .firestore()
      .collection("users")
      .doc(firebaseUid)
      .collection("discord")
      .doc("profile")
      .delete();

    // Log to admin logs
    await admin.firestore().collection("adminLogs").add({
      action: "discord_unlinked",
      details: discordData
        ? `Discord account unlinked: @${discordData.username} (${discordData.discordId})`
        : "Discord account unlinked",
      userId: firebaseUid,
      discordId: discordData?.discordId || null,
      discordUsername: discordData?.username || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🔓 Discord account unlinked for Firebase UID: ${firebaseUid}`);

    res.json({
      success: true,
      message: "Discord account unlinked successfully",
    });
  } catch (error) {
    console.error("Error unlinking Discord account:", error);
    res.status(500).json({
      success: false,
      error: "Failed to unlink Discord account",
    });
  }
});

/**
 * GET /api/oauth/discord/profile
 * Protected endpoint - fetch user's linked Discord profile
 */
router.get("/discord/profile", authLimiter, verifyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;

    const profileDoc = await admin
      .firestore()
      .collection("users")
      .doc(firebaseUid)
      .collection("discord")
      .doc("profile")
      .get();

    if (!profileDoc.exists) {
      return res.json({
        success: true,
        profile: null,
      });
    }

    const profileData = profileDoc.data();

    res.json({
      success: true,
      profile: profileData,
    });
  } catch (error) {
    console.error("Error fetching Discord profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Discord profile",
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Get team members by role
router.get('/api/team', async (req, res) => {
  try {
    const client = req.app.locals.client;
    const config = req.app.locals.config;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        error: 'Discord bot is not ready',
        members: []
      });
    }

    // Support both guild_ids array and legacy guild_id
    const guildId = config.guild_id || (config.guild_ids && config.guild_ids[0]);

    if (!guildId) {
      return res.status(404).json({
        error: 'No guild configured',
        members: []
      });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({
        error: 'Guild not found',
        members: []
      });
    }

    // Team role ID from the user
    const TEAM_ROLE_ID = '1451251793303703620';

    // Get members with the team role (already cached on bot startup)
    const teamMembers = guild.members.cache.filter(member =>
      member.roles.cache.has(TEAM_ROLE_ID)
    );

    // If cache is empty, return empty array with success
    if (teamMembers.size === 0) {
      return res.json({
        success: true,
        members: [],
        count: 0
      });
    }

    // Map to simpler format for frontend
    const members = await Promise.all(teamMembers.map(async (member) => {
      // Fetch full user data to get banner
      let fullUser;
      try {
        fullUser = await client.users.fetch(member.user.id, { force: true });
      } catch (error) {
        console.error(`Error fetching user ${member.user.id}:`, error);
        fullUser = member.user;
      }

      // Get user avatar URL
      const avatarURL = fullUser.displayAvatarURL({
        format: 'png',
        size: 256
      });

      // Get user banner URL (if they have one)
      const bannerURL = fullUser.bannerURL({
        format: 'png',
        size: 1024
      });

      // Get member's highest role color
      const roleColor = member.displayHexColor !== '#000000'
        ? member.displayHexColor
        : '#8B5CF6'; // Default to violet

      // Get custom status if available
      const customStatus = member.presence?.activities?.find(
        activity => activity.type === 4 // Custom status
      )?.state || null;

      // Get current activity/game
      const currentActivity = member.presence?.activities?.find(
        activity => activity.type === 0 // Playing
      )?.name || null;

      return {
        id: member.user.id,
        username: member.user.username,
        displayName: member.displayName,
        avatar: avatarURL,
        banner: bannerURL,
        bannerColor: fullUser.hexAccentColor,
        roleColor: roleColor,
        // Get the team role name
        teamRole: member.roles.cache.get(TEAM_ROLE_ID)?.name || 'Team Member',
        // Optional: include user status/presence
        status: member.presence?.status || 'offline',
        customStatus: customStatus,
        currentActivity: currentActivity,
        joinedAt: member.joinedTimestamp,
        // Get all roles (excluding @everyone)
        roles: member.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => ({ name: role.name, color: role.hexColor }))
          .slice(0, 3) // Limit to top 3 roles
      };
    }));

    // Sort by join date (earliest = most senior)
    const sortedMembers = members.sort((a, b) => a.joinedAt - b.joinedAt);

    res.json({
      success: true,
      members: sortedMembers,
      count: sortedMembers.length
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      error: 'Failed to fetch team members',
      members: []
    });
  }
});

module.exports = router;

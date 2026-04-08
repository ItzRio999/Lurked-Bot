const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

const commands = [
  // ============== QUICK SETUP ==============
  new SlashCommandBuilder()
    .setName("quicksetup")
    .setDescription("⚡ Quick setup for bot features - one command does it all!")
    .addSubcommand(sub =>
      sub
        .setName("tickets")
        .setDescription("Setup the entire ticket system in one command")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category where tickets will be created")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("logchannel")
            .setDescription("Channel for ticket logs and transcripts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName("title").setDescription("Panel title (optional)"))
        .addStringOption(opt => opt.setName("color").setDescription("Panel color in hex (e.g., #5865F2) (optional)"))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("addownerrole")
    .setDescription("Add an owner role")
    .addRoleOption((opt) => opt.setName("role").setDescription("Owner role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("addcoownerrole")
    .setDescription("Add a co-owner role")
    .addRoleOption((opt) => opt.setName("role").setDescription("Co-owner role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== TICKET SYSTEM ==============
  new SlashCommandBuilder()
    .setName("ticketsetup")
    .setDescription("Configure ticket system - all settings in one command!")
    .addSubcommand(sub =>
      sub
        .setName("channels")
        .setDescription("Set ticket category and log channel")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category for tickets (must be a category, not a text channel)")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("logchannel")
            .setDescription("Channel for ticket logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("panel")
        .setDescription("Customize the ticket panel embed")
        .addStringOption(opt => opt.setName("title").setDescription("Panel title").setRequired(false))
        .addStringOption(opt => opt.setName("description").setDescription("Panel description").setRequired(false))
        .addStringOption(opt => opt.setName("color").setDescription("Hex color (e.g., #5865F2)").setRequired(false))
        .addStringOption(opt => opt.setName("footer").setDescription("Footer text").setRequired(false))
        .addStringOption(opt => opt.setName("thumbnail").setDescription("Thumbnail image URL").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("addbutton")
        .setDescription("Add a ticket category button")
        .addStringOption(opt => opt.setName("id").setDescription("Button ID (e.g., general, bug, billing)").setRequired(true))
        .addStringOption(opt => opt.setName("label").setDescription("Button text shown to users").setRequired(true))
        .addStringOption(opt => opt.setName("emoji").setDescription("Button emoji (e.g., 🔧, 🐛, 💰)").setRequired(true))
        .addStringOption(opt =>
          opt
            .setName("style")
            .setDescription("Button color")
            .setRequired(true)
            .addChoices(
              { name: "Blue (Primary)", value: "Primary" },
              { name: "Gray (Secondary)", value: "Secondary" },
              { name: "Green (Success)", value: "Success" },
              { name: "Red (Danger)", value: "Danger" }
            )
        )
        .addStringOption(opt => opt.setName("description").setDescription("What this button is for (optional)"))
    )
    .addSubcommand(sub =>
      sub
        .setName("removebutton")
        .setDescription("Remove a ticket button by ID")
        .addStringOption(opt => opt.setName("id").setDescription("Button ID to remove").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("listbuttons")
        .setDescription("Show all configured ticket buttons")
    )
    .addSubcommand(sub =>
      sub
        .setName("reorderbuttons")
        .setDescription("Reorder ticket buttons by their IDs")
        .addStringOption(opt => opt.setName("order").setDescription("Button IDs in order (comma-separated, e.g., general,bug,account,other)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription("Reset ticket panel to default settings")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Post the ticket panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== ROLES PANEL ==============
  new SlashCommandBuilder()
    .setName("rolespanel")
    .setDescription("Configure and manage the self-roles panel")
    .addSubcommand(sub =>
      sub
        .setName("configure")
        .setDescription("Configure a role for the panel")
        .addStringOption(opt =>
          opt
            .setName("id")
            .setDescription("Role ID (announcements or drops)")
            .setRequired(true)
            .addChoices(
              { name: "Announcements", value: "announcements" },
              { name: "Account Drops", value: "drops" }
            )
        )
        .addRoleOption(opt => opt.setName("role").setDescription("The role to assign").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("customize")
        .setDescription("Customize the panel appearance")
        .addStringOption(opt => opt.setName("title").setDescription("Panel title"))
        .addStringOption(opt => opt.setName("description").setDescription("Panel description"))
        .addStringOption(opt => opt.setName("color").setDescription("Hex color (e.g., #5865F2)"))
    )
    .addSubcommand(sub =>
      sub
        .setName("post")
        .setDescription("Post the roles panel in this channel")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== MODERATION ==============
  new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("🔥 Nuke messages in bulk")
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("Number of messages to nuke (1-1000)").setRequired(true).setMinValue(1).setMaxValue(1000)
    )
    .addUserOption((opt) => opt.setName("user").setDescription("Only nuke messages from this user"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user (prevent them from sending messages)")
    .addUserOption(opt => opt.setName("user").setDescription("User to timeout").setRequired(true))
    .addIntegerOption(opt =>
      opt
        .setName("duration")
        .setDescription("Duration in minutes")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320) // 28 days max
    )
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for timeout"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user")
    .addUserOption(opt => opt.setName("user").setDescription("User to remove timeout from").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for removing timeout"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption(opt => opt.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for kick"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Permanently ban a user (hard ban)")
    .addUserOption(opt => opt.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for ban"))
    .addIntegerOption(opt =>
      opt
        .setName("delete_days")
        .setDescription("Delete messages from last X days (1-7)")
        .setMinValue(1)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Kick user and delete their messages (can rejoin)")
    .addUserOption(opt => opt.setName("user").setDescription("User to soft ban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for soft ban"))
    .addIntegerOption(opt =>
      opt
        .setName("delete_days")
        .setDescription("Delete messages from last X days (1-7)")
        .setMinValue(1)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(opt => opt.setName("user_id").setDescription("User ID to unban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for unban"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("viewbans")
    .setDescription("View security trap ban history")
    .addUserOption(opt => opt.setName("user").setDescription("Filter results to one user"))
    .addIntegerOption(opt =>
      opt
        .setName("limit")
        .setDescription("How many recent cases to show (default: 5)")
        .setMinValue(1)
        .setMaxValue(10)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // ============== AUTO-MODERATION ==============
  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure auto-moderation system")
    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription("Enable auto-moderation")
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable auto-moderation")
    )
    .addSubcommand(sub =>
      sub
        .setName("spam")
        .setDescription("Configure spam filter")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable spam filter"))
        .addIntegerOption(opt => opt.setName("messages").setDescription("Message limit (default: 5)").setMinValue(3).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("seconds").setDescription("Time window in seconds (default: 5)").setMinValue(2).setMaxValue(30))
    )
    .addSubcommand(sub =>
      sub
        .setName("caps")
        .setDescription("Configure caps filter")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable caps filter"))
        .addIntegerOption(opt => opt.setName("percentage").setDescription("Caps percentage threshold (default: 70)").setMinValue(50).setMaxValue(100))
    )
    .addSubcommand(sub =>
      sub
        .setName("links")
        .setDescription("Configure link filter")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable link filter"))
        .addBooleanOption(opt => opt.setName("block_invites").setDescription("Block Discord invites"))
    )
    .addSubcommand(sub =>
      sub
        .setName("badwords")
        .setDescription("Manage bad words list")
        .addStringOption(opt => opt.setName("word").setDescription("Word to add/remove").setRequired(true))
        .addBooleanOption(opt => opt.setName("remove").setDescription("Remove word instead of adding"))
    )
    .addSubcommand(sub =>
      sub
        .setName("whitelist")
        .setDescription("Manage whitelisted domains")
        .addStringOption(opt => opt.setName("domain").setDescription("Domain to add/remove (e.g., youtube.com)").setRequired(true))
        .addBooleanOption(opt => opt.setName("remove").setDescription("Remove domain instead of adding"))
    )
    .addSubcommand(sub =>
      sub
        .setName("logchannel")
        .setDescription("Set auto-mod log channel")
        .addChannelOption(opt => opt.setName("channel").setDescription("Log channel").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("immune")
        .setDescription("Manage roles immune to all auto-moderation")
        .addRoleOption(opt => opt.setName("role").setDescription("Role to add/remove").setRequired(true))
        .addBooleanOption(opt => opt.setName("remove").setDescription("Remove role instead of adding"))
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("View auto-moderation configuration")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View detailed information about a user")
    .addUserOption(opt => opt.setName("user").setDescription("User to view (leave empty for yourself)")),

  // ============== TICKET ENHANCEMENTS ==============
  new SlashCommandBuilder()
    .setName("ticketpriority")
    .setDescription("Set ticket priority")
    .addStringOption(opt =>
      opt
        .setName("priority")
        .setDescription("Priority level")
        .setRequired(true)
        .addChoices(
          { name: "🟢 Low", value: "low" },
          { name: "🟡 Medium", value: "medium" },
          { name: "🟠 High", value: "high" },
          { name: "🔴 Urgent", value: "urgent" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketnote")
    .setDescription("Add a staff note to the ticket")
    .addStringOption(opt => opt.setName("note").setDescription("Note content").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketnotes")
    .setDescription("View all notes on this ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketstats")
    .setDescription("View ticket system statistics")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketautoclose")
    .setDescription("Configure auto-close for inactive tickets")
    .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable auto-close").setRequired(true))
    .addIntegerOption(opt => opt.setName("hours").setDescription("Hours of inactivity before auto-close (default: 48)").setMinValue(12).setMaxValue(168))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticketrename")
    .setDescription("Rename the current ticket channel")
    .addStringOption(opt => opt.setName("name").setDescription("New name for the ticket (e.g., billing-issue)").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("setratingschannel")
    .setDescription("Set the channel for ticket ratings and feedback")
    .addChannelOption(opt => opt.setName("channel").setDescription("Ratings channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticketadd")
    .setDescription("Add a user to the current ticket")
    .addUserOption(opt => opt.setName("user").setDescription("User to add to the ticket").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketremove")
    .setDescription("Remove a user from the current ticket")
    .addUserOption(opt => opt.setName("user").setDescription("User to remove from the ticket").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketparticipants")
    .setDescription("View all participants in the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // ============== GIVEAWAYS ==============
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Start a new giveaway")
        .addStringOption(opt => opt.setName("prize").setDescription("Giveaway prize").setRequired(true))
        .addIntegerOption(opt => opt.setName("duration").setDescription("Duration in minutes (1-10080)").setRequired(true).setMinValue(1).setMaxValue(10080))
        .addIntegerOption(opt => opt.setName("winners").setDescription("Number of winners (1-20, default: 1)").setMinValue(1).setMaxValue(20))
        .addStringOption(opt => opt.setName("description").setDescription("Additional description"))
        .addStringOption(opt => opt.setName("image").setDescription("Image URL for the giveaway"))
    )
    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption(opt => opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription("Reroll giveaway winners")
        .addStringOption(opt => opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true))
        .addIntegerOption(opt => opt.setName("winners").setDescription("Number of new winners (default: 1)").setMinValue(1).setMaxValue(20))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all giveaways in the server")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  // ============== HELP ==============
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands and features"),

  // ============== DISCORD VERIFY ==============
  new SlashCommandBuilder()
    .setName("verifyembed")
    .setDescription("Post the Discord verification embed in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("verifylog")
    .setDescription("Configure verification logging")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set the verification log channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for verification logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== POLL SYSTEM ==============
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption((opt) => opt.setName("question").setDescription("Poll question").setRequired(true))
    .addStringOption((opt) => opt.setName("option1").setDescription("Option 1").setRequired(true))
    .addStringOption((opt) => opt.setName("option2").setDescription("Option 2").setRequired(true))
    .addStringOption((opt) => opt.setName("option3").setDescription("Option 3"))
    .addStringOption((opt) => opt.setName("option4").setDescription("Option 4"))
    .addStringOption((opt) => opt.setName("option5").setDescription("Option 5"))
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Duration in minutes (default: 60)")
        .setMinValue(1)
        .setMaxValue(10080)
    ),

  // ============== WELCOME/LEAVE MESSAGES ==============
  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome message channel and content")
    .addChannelOption((opt) => opt.setName("channel").setDescription("Welcome channel").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Message (use {user} for mention, {server} for server name)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setleave")
    .setDescription("Set leave message channel and content")
    .addChannelOption((opt) => opt.setName("channel").setDescription("Leave channel").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Message (use {user} for username, {server} for server name)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("disablewelcome")
    .setDescription("Disable welcome messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("disableleave")
    .setDescription("Disable leave messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== AUDIT LOGGING ==============
  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("Set the audit log channel")
    .addChannelOption((opt) => opt.setName("channel").setDescription("Log channel").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("disablelogs")
    .setDescription("Disable audit logging")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configure which types of events are logged")
    .addSubcommand(sub =>
      sub
        .setName("config")
        .setDescription("View or configure log settings")
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Type of log to configure")
            .addChoices(
              { name: "Moderation (ban, kick, timeout)", value: "moderation" },
              { name: "Member Join/Leave", value: "member_events" },
              { name: "Role Updates", value: "role_updates" },
              { name: "Message Delete", value: "message_delete" },
              { name: "Message Edit", value: "message_edit" },
              { name: "Bulk Delete (Nuke)", value: "message_bulk_delete" }
            )
        )
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable or disable this log type")
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View current logging configuration")
    )
    .addSubcommand(sub =>
      sub
        .setName("enableall")
        .setDescription("Enable all log types")
    )
    .addSubcommand(sub =>
      sub
        .setName("disableall")
        .setDescription("Disable all log types (except member events)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== VERIFICATION SYSTEM ==============
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verification management commands")
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Manually verify a user")
        .addUserOption(opt => opt.setName("user").setDescription("User to verify").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("unverify")
        .setDescription("Remove verification from a user")
        .addUserOption(opt => opt.setName("user").setDescription("User to unverify").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("stats")
        .setDescription("View verification statistics")
    )
    .addSubcommand(sub =>
      sub
        .setName("config")
        .setDescription("Configure verification settings")
        .addStringOption(opt =>
          opt
            .setName("setting")
            .setDescription("Setting to configure")
            .setRequired(true)
            .addChoices(
              { name: "Verified Role", value: "role" },
              { name: "Minimum Account Age (days)", value: "min_age" },
              { name: "Send DM on Join", value: "dm_on_join" }
            )
        )
        .addStringOption(opt =>
          opt.setName("value").setDescription("Value for the setting (true/false or number)")
        )
        .addRoleOption(opt =>
          opt.setName("role_value").setDescription("Role (for role setting)")
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("setchannel")
        .setDescription("Set the verification channel")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Channel for verification panel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== ROLE MANAGEMENT ==============
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add a role to a user")
    .addUserOption(opt => opt.setName("user").setDescription("User to give the role to").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setDescription("Role to add").setRequired(true))
    .addRoleOption(opt => opt.setName("role2").setDescription("Additional role to add"))
    .addRoleOption(opt => opt.setName("role3").setDescription("Additional role to add"))
    .addRoleOption(opt => opt.setName("role4").setDescription("Additional role to add"))
    .addRoleOption(opt => opt.setName("role5").setDescription("Additional role to add"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove a role from a user")
    .addUserOption(opt => opt.setName("user").setDescription("User to remove the role from").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setDescription("Role to remove").setRequired(true))
    .addRoleOption(opt => opt.setName("role2").setDescription("Additional role to remove"))
    .addRoleOption(opt => opt.setName("role3").setDescription("Additional role to remove"))
    .addRoleOption(opt => opt.setName("role4").setDescription("Additional role to remove"))
    .addRoleOption(opt => opt.setName("role5").setDescription("Additional role to remove"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // ============== SECURITY DASHBOARD ==============
  new SlashCommandBuilder()
    .setName("security")
    .setDescription("Security dashboard and logs")
    .addSubcommand(sub =>
      sub
        .setName("dashboard")
        .setDescription("View the security dashboard with stats and alerts")
    )
    .addSubcommand(sub =>
      sub
        .setName("logs")
        .setDescription("View recent security logs")
        .addBooleanOption(opt =>
          opt.setName("alerts_only").setDescription("Show only alerts and critical events")
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("setchannel")
        .setDescription("Set the security log channel")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Channel for security logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== EMBED CREATOR ==============
  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create a custom embed message")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a basic custom embed")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Channel to send the embed to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("advanced")
        .setDescription("Create an advanced embed with fields")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Channel to send the embed to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ============== INVITE TRACKING ==============
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Check invite stats for a user")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to check (leave empty for yourself)")
    ),

  new SlashCommandBuilder()
    .setName("inviteleaderboard")
    .setDescription("Show the top inviters in the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== MOVIE REQUESTS ==============
  new SlashCommandBuilder()
    .setName("requestmovie")
    .setDescription("Request a movie for a future movie night")
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Movie title")
        .setRequired(true)
        .setMaxLength(200)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("year")
        .setDescription("Release year to improve movie matching")
        .setRequired(true)
        .setMinValue(1900)
        .setMaxValue(2100)
    )
    .addStringOption((opt) =>
      opt
        .setName("details")
        .setDescription("Why you want it hosted or any extra notes")
        .setMaxLength(500)
    )
    .addStringOption((opt) =>
      opt
        .setName("link")
        .setDescription("Optional IMDb, TMDb, trailer, or reference link")
        .setMaxLength(500)
    ),

  new SlashCommandBuilder()
    .setName("movierequests")
    .setDescription("View recent movie requests")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("How many requests to show")
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Filter requests to one user")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("debugroles")
    .setDescription("Show the roles the bot sees for a user")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to inspect")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== TIMED ROLES ==============
  new SlashCommandBuilder()
    .setName("timedrole")
    .setDescription("Assign a role to a user for a set duration")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to assign the role to").setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to assign").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("How long to assign the role")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((opt) =>
      opt
        .setName("unit")
        .setDescription("Time unit (default: hours)")
        .addChoices(
          { name: "Minutes", value: "minutes" },
          { name: "Hours", value: "hours" },
          { name: "Days", value: "days" },
          { name: "Weeks", value: "weeks" },
          { name: "Months", value: "months" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("timedrolelist")
    .setDescription("Show all active timed roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("timedroleremove")
    .setDescription("Remove a timed role from a user early")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to remove the role from").setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to remove").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== VOUCH SYSTEM ==============
  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Submit a vouch/review for this server")
    .addStringOption(opt =>
      opt.setName("message").setDescription("Your vouch message").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("stars").setDescription("Star rating (1-5)").setRequired(true).setMinValue(1).setMaxValue(5)
    )
    .addAttachmentOption(opt =>
      opt.setName("proof").setDescription("Optional proof image/video (PNG, JPG, JPEG, WEBP, GIF, MP4)")
    ),

  new SlashCommandBuilder()
    .setName("vouchbackup")
    .setDescription("Backup all vouches to Firebase Firestore")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("vouchrestore")
    .setDescription("Restore vouches from the latest Firebase Firestore backup")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ============== STICKY MESSAGE ==============
  new SlashCommandBuilder()
    .setName("stickymessage")
    .setDescription("Post or refresh the sticky info embed in bot-cmds channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

].map((c) => c.toJSON());

module.exports = commands;

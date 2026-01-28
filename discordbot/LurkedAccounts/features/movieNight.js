const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { saveJson } = require("../utils/fileManager");

// Movie announce
async function announceMovie(interaction, config, data, dataPath, io) {
  const title = interaction.options.getString("title", true);

  // Validate title length (Discord embed title limit is 256 characters)
  if (title.length > 256) {
    return interaction.reply({
      content: "❌ Movie title is too long! Please use a title under 256 characters.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const voiceChannel = interaction.options.getChannel("voice");
  const time = interaction.options.getString("time");
  const genre = interaction.options.getString("genre");
  const runtime = interaction.options.getString("runtime");
  const poster = interaction.options.getString("poster");

  // Get movie role from config
  const movieRole = config.roles_panel?.roles?.find(r => r.id === "movies")?.role_id;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xFF6B6B)
    .setTimestamp();

  const fields = [];
  if (time) fields.push({ name: "⏰ Time", value: time, inline: true });
  if (voiceChannel) fields.push({ name: "🔊 Voice Channel", value: `${voiceChannel}`, inline: true });
  if (genre) fields.push({ name: "🎭 Genre", value: genre, inline: true });
  if (runtime) fields.push({ name: "⏱️ Runtime", value: runtime, inline: true });

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  embed.addFields(
    { name: "Attending", value: "0", inline: true },
    { name: "Maybe", value: "0", inline: true },
    { name: "\u200b", value: "\u200b", inline: true }
  );

  if (poster) embed.setImage(poster);
  embed.setFooter({ text: "Click the buttons below to RSVP or react during the movie" });

  // Add reaction buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("movie_attending")
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId("movie_maybe")
      .setLabel("Maybe")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("❓"),
    new ButtonBuilder()
      .setCustomId("movie_reactions")
      .setLabel("Reactions")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("💬")
  );

  const pingContent = movieRole ? `<@&${movieRole}>` : "";
  const message = await interaction.channel.send({
    content: pingContent,
    embeds: [embed],
    components: [row]
  });

  // Track movie in data
  if (!data.movies) data.movies = [];
  const newMovie = {
    message_id: message.id,
    title: title,
    announced_at: new Date().toISOString(),
    announced_by: interaction.user.id,
    channel_id: interaction.channel.id,
    voice_channel: voiceChannel?.id || null,
    time: time || null,
    genre: genre || null,
    runtime: runtime || null,
    attending: [],
    maybe: [],
    stats: { reactions: 0 }
  };
  data.movies.push(newMovie);
  saveJson(dataPath, data);

  // Emit WebSocket event for new movie announcement
  if (io) {
    io.emit('movieAnnounced', {
      id: message.id,
      type: 'movie',
      title: title,
      date: newMovie.announced_at,
      time: time,
      genre: genre,
      runtime: runtime,
      status: 'active'
    });
    console.log(`🔔 WebSocket: Emitted movieAnnounced event for "${title}"`);
  }

  const successEmbed = new EmbedBuilder()
    .setDescription("✅ Movie announced! Users can now RSVP.")
    .setColor(0x57F287);

  await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
}

// Handle movie button interactions
async function handleMovieButton(interaction, buttonType, data, dataPath) {
  const movie = data.movies?.find(m => m.message_id === interaction.message.id);

  if (!movie) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Movie data not found!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const userId = interaction.user.id;

  if (buttonType === "attending") {
    // Toggle attending
    if (movie.attending.includes(userId)) {
      movie.attending = movie.attending.filter(id => id !== userId);
      const embed = new EmbedBuilder()
        .setDescription("Removed from attending list")
        .setColor(0xED4245);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      movie.attending.push(userId);
      movie.maybe = movie.maybe.filter(id => id !== userId); // Remove from maybe
      const embed = new EmbedBuilder()
        .setDescription("✅ You're attending!")
        .setColor(0x57F287);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    saveJson(dataPath, data);

    // Update the announcement embed with new counts
    await updateMovieEmbed(interaction, movie);
  }
  else if (buttonType === "maybe") {
    // Toggle maybe
    if (movie.maybe.includes(userId)) {
      movie.maybe = movie.maybe.filter(id => id !== userId);
      const embed = new EmbedBuilder()
        .setDescription("Removed from maybe list")
        .setColor(0xED4245);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      movie.maybe.push(userId);
      movie.attending = movie.attending.filter(id => id !== userId); // Remove from attending
      const embed = new EmbedBuilder()
        .setDescription("❓ Marked as maybe")
        .setColor(0x57F287);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    saveJson(dataPath, data);

    // Update the announcement embed with new counts
    await updateMovieEmbed(interaction, movie);
  }
  else if (buttonType === "reactions") {
    // Show reaction buttons
    const reactionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("movie_react_popcorn")
        .setLabel("Popcorn")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🍿"),
      new ButtonBuilder()
        .setCustomId("movie_react_scary")
        .setLabel("Scary")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("😱"),
      new ButtonBuilder()
        .setCustomId("movie_react_funny")
        .setLabel("Funny")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("😂"),
      new ButtonBuilder()
        .setCustomId("movie_react_sad")
        .setLabel("Sad")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("😢"),
      new ButtonBuilder()
        .setCustomId("movie_react_fire")
        .setLabel("Fire")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔥")
    );

    const embed = new EmbedBuilder()
      .setDescription("Send a reaction during the movie:")
      .setColor(0x5865F2);

    await interaction.reply({
      embeds: [embed],
      components: [reactionRow],
      flags: MessageFlags.Ephemeral
    });
  }
  else if (buttonType.startsWith("react_")) {
    // Send reaction to chat
    const reactions = {
      "react_popcorn": "🍿",
      "react_scary": "😱",
      "react_funny": "😂",
      "react_sad": "😢",
      "react_fire": "🔥"
    };

    const emoji = reactions[buttonType];
    await interaction.channel.send(`${emoji} ${interaction.user}`);
    movie.stats.reactions++;
    saveJson(dataPath, data);

    const embed = new EmbedBuilder()
      .setDescription(`${emoji} Reaction sent!`)
      .setColor(0x57F287);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// Update movie announcement embed with current attendance
async function updateMovieEmbed(interaction, movie) {
  try {
    const message = await interaction.channel.messages.fetch(movie.message_id);
    const oldEmbed = message.embeds[0];

    const updatedEmbed = new EmbedBuilder()
      .setTitle(oldEmbed.title)
      .setColor(oldEmbed.color)
      .setFooter({ text: "Click the buttons below to RSVP or react during the movie" });

    const fields = [];
    if (movie.time) fields.push({ name: "⏰ Time", value: movie.time, inline: true });
    if (movie.voice_channel) {
      const channel = await interaction.guild.channels.fetch(movie.voice_channel).catch(() => null);
      if (channel) fields.push({ name: "🔊 Voice Channel", value: `${channel}`, inline: true });
    }
    if (movie.genre) fields.push({ name: "🎭 Genre", value: movie.genre, inline: true });
    if (movie.runtime) fields.push({ name: "⏱️ Runtime", value: movie.runtime, inline: true });

    if (fields.length > 0) {
      updatedEmbed.addFields(fields);
    }

    updatedEmbed.addFields(
      { name: "Attending", value: movie.attending.length.toString(), inline: true },
      { name: "Maybe", value: movie.maybe.length.toString(), inline: true },
      { name: "\u200b", value: "\u200b", inline: true }
    );

    if (oldEmbed.image) updatedEmbed.setImage(oldEmbed.image.url);

    await message.edit({ embeds: [updatedEmbed] });
  } catch (error) {
    console.error("Error updating movie embed:", error);
  }
}

// Show movie schedule
async function showSchedule(interaction, data) {
  if (!data.movie_schedule || data.movie_schedule.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("No upcoming movies scheduled.\nUse `/movie schedule` to add one!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Sort by date
  const upcoming = data.movie_schedule
    .filter(m => new Date(m.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (upcoming.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("No upcoming movies scheduled.")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setTitle("Upcoming Movie Schedule")
    .setColor(0xFF6B6B)
    .setTimestamp()
    .setFooter({ text: `${upcoming.length} upcoming movie${upcoming.length !== 1 ? "s" : ""}` });

  upcoming.forEach((movie, i) => {
    const date = new Date(movie.date);
    const timestamp = Math.floor(date.getTime() / 1000);
    embed.addFields({
      name: `${i + 1}. ${movie.title}`,
      value: `🕒 <t:${timestamp}:F> (<t:${timestamp}:R>)${movie.genre ? `\n🎭 ${movie.genre}` : ""}`,
      inline: false
    });
  });

  await interaction.reply({ embeds: [embed] });
}

// Add to schedule
async function addToSchedule(interaction, data, dataPath, io) {
  const title = interaction.options.getString("title", true);
  const date = interaction.options.getString("date", true);
  const genre = interaction.options.getString("genre");

  // Validate date format (basic check)
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    const embed = new EmbedBuilder()
      .setDescription("❌ Invalid date format! Use format like: `2025-12-31 8:00 PM` or `December 31, 2025 8:00 PM`")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (!data.movie_schedule) data.movie_schedule = [];

  const newScheduledMovie = {
    id: Date.now().toString(),
    title: title,
    date: parsedDate.toISOString(),
    genre: genre,
    added_by: interaction.user.id,
    added_at: new Date().toISOString()
  };

  data.movie_schedule.push(newScheduledMovie);

  saveJson(dataPath, data);

  // Emit WebSocket event for new scheduled movie
  if (io) {
    io.emit('movieScheduleAdded', {
      id: newScheduledMovie.id,
      type: 'movie',
      title: title,
      date: newScheduledMovie.date,
      genre: genre,
      status: 'scheduled'
    });
    console.log(`🔔 WebSocket: Emitted movieScheduleAdded event for "${title}"`);
  }

  const timestamp = Math.floor(parsedDate.getTime() / 1000);
  const embed = new EmbedBuilder()
    .setTitle("Movie Added to Schedule")
    .setColor(0x57F287)
    .addFields(
      { name: "Movie", value: title, inline: false },
      { name: "Date & Time", value: `<t:${timestamp}:F>`, inline: false },
      { name: "Countdown", value: `<t:${timestamp}:R>`, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `Scheduled by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

  if (genre) {
    embed.addFields({ name: "Genre", value: genre, inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

// Remove from schedule
async function removeFromSchedule(interaction, data, dataPath, io) {
  const index = interaction.options.getInteger("number", true) - 1;

  if (!data.movie_schedule || data.movie_schedule.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("❌ No movies in schedule!")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const upcoming = data.movie_schedule
    .map((m, i) => ({ ...m, originalIndex: i }))
    .filter(m => new Date(m.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (index < 0 || index >= upcoming.length) {
    const embed = new EmbedBuilder()
      .setDescription(`❌ Invalid number! Choose 1-${upcoming.length}`)
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const removed = upcoming[index];
  data.movie_schedule.splice(removed.originalIndex, 1);
  saveJson(dataPath, data);

  // Emit WebSocket event for removed scheduled movie
  if (io) {
    io.emit('movieScheduleRemoved', {
      id: removed.id,
      title: removed.title
    });
    console.log(`🔔 WebSocket: Emitted movieScheduleRemoved event for "${removed.title}"`);
  }

  const embed = new EmbedBuilder()
    .setDescription(`✅ Removed **${removed.title}** from schedule`)
    .setColor(0x57F287);

  await interaction.reply({ embeds: [embed] });
}

// Show movie stats
async function showStats(interaction, data) {
  if (!data.movies || data.movies.length === 0) {
    const embed = new EmbedBuilder()
      .setDescription("No movie history yet! Host a movie with `/movie announce`")
      .setColor(0xED4245);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const totalMovies = data.movies.length;
  const totalAttendees = data.movies.reduce((sum, m) => sum + m.attending.length, 0);
  const avgAttendance = totalAttendees > 0 ? Math.round(totalAttendees / totalMovies) : 0;
  const totalReactions = data.movies.reduce((sum, m) => sum + (m.stats?.reactions || 0), 0);

  // Most popular movie
  const mostPopular = data.movies.reduce((max, m) =>
    m.attending.length > (max.attending?.length || 0) ? m : max, data.movies[0]);

  // Recent movies (last 5)
  const recent = data.movies.slice(-5).reverse().map((m, i) => {
    const date = new Date(m.announced_at);
    const timestamp = Math.floor(date.getTime() / 1000);
    return `${i + 1}. **${m.title}**${m.genre ? ` (${m.genre})` : ""}\n   <t:${timestamp}:R> • ${m.attending.length} attended`;
  }).join("\n");

  // Genre breakdown
  const genres = {};
  data.movies.forEach(m => {
    if (m.genre) {
      genres[m.genre] = (genres[m.genre] || 0) + 1;
    }
  });
  const topGenres = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre, count]) => `${genre} (${count})`)
    .join(", ");

  const embed = new EmbedBuilder()
    .setTitle("Movie Night Statistics")
    .setColor(0xFF6B6B)
    .setDescription(`**Total Movies Hosted:** ${totalMovies}`)
    .addFields(
      { name: "Average Attendance", value: `${avgAttendance} viewers`, inline: true },
      { name: "Total Reactions", value: `${totalReactions}`, inline: true },
      { name: "\u200b", value: "\u200b", inline: true }
    )
    .setTimestamp();

  if (mostPopular) {
    embed.addFields({
      name: "Most Popular Movie",
      value: `**${mostPopular.title}**\n${mostPopular.attending.length} attendees`,
      inline: false
    });
  }

  if (topGenres) {
    embed.addFields({ name: "Top Genres", value: topGenres, inline: false });
  }

  if (recent) {
    embed.addFields({ name: "Recent Movies", value: recent, inline: false });
  }

  // Upcoming from schedule
  if (data.movie_schedule && data.movie_schedule.length > 0) {
    const upcoming = data.movie_schedule
      .filter(m => new Date(m.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 2);

    if (upcoming.length > 0) {
      const upcomingText = upcoming.map(m => {
        const timestamp = Math.floor(new Date(m.date).getTime() / 1000);
        return `• ${m.title} - <t:${timestamp}:R>`;
      }).join("\n");
      embed.addFields({ name: "Coming Up Next", value: upcomingText, inline: false });
    }
  }

  await interaction.reply({ embeds: [embed] });
}

// Volume/audio help - Enhanced with tested solutions
async function showVolumeHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("Audio & Volume Troubleshooting")
    .setColor(0x5865F2)
    .addFields(
      {
        name: "Step 1: Discord User Volume",
        value: "Right-click the host's profile → User Volume → Slide to 200%\nThis is the most common fix for low volume",
        inline: false
      },
      {
        name: "Step 2: Browser Extensions",
        value:
          "Chrome/Edge: Volume Master extension (up to 600%)\n" +
          "Firefox: Volume Booster addon (up to 600%)\n" +
          "Install → Click icon → Boost to 200-400%",
        inline: false
      },
      {
        name: "Step 3: System Volume (Windows)",
        value: "Sound Settings → Discord → App volume → 100%\nOR: Volume Mixer (Win+G) → Discord to max",
        inline: false
      },
      {
        name: "Step 4: Host Settings",
        value: "When screen sharing: Check 'Share audio'\nShare entire screen (not tab) for better quality",
        inline: false
      },
      {
        name: "Advanced Fixes",
        value:
          "1. Discord: Voice & Video → Input Sensitivity (disable auto)\n" +
          "2. Windows: Sound → Playback → Discord → Enhancements → Loudness Equalization\n" +
          "3. Update audio drivers (Device Manager)\n" +
          "4. Try different voice region (Server Settings)",
        inline: false
      },
      {
        name: "No Audio At All?",
        value:
          "• Host: Stop share → Reshare → Check 'Share audio'\n" +
          "• Viewers: Leave VC and rejoin\n" +
          "• Refresh Discord (Ctrl+R)\n" +
          "• Check browser isn't muted in volume mixer",
        inline: false
      },
      {
        name: "Audio Cutting/Lagging?",
        value:
          "• Lower bitrate: Voice & Video → Bitrate (96kbps)\n" +
          "• Enable Legacy Audio subsystem\n" +
          "• Host: Close Chrome tabs\n" +
          "• Need 5+ Mbps upload speed",
        inline: false
      }
    )
    .setTimestamp()
    .setFooter({ text: "Test audio 30 seconds before movie starts" });

  await interaction.reply({ embeds: [embed] });
}

// Quick movie poll
async function createMoviePoll(interaction, data, dataPath) {
  const question = interaction.options.getString("question") || "Which movie should we watch?";
  const option1 = interaction.options.getString("movie1", true);
  const option2 = interaction.options.getString("movie2", true);
  const option3 = interaction.options.getString("movie3");
  const option4 = interaction.options.getString("movie4");

  const options = [option1, option2, option3, option4].filter(Boolean);
  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

  const embed = new EmbedBuilder()
    .setTitle(question)
    .setColor(0xFF6B6B)
    .setFooter({ text: `Poll by ${interaction.user.username} - React to vote`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  options.forEach((opt, i) => {
    embed.addFields({ name: `${emojis[i]} Option ${i + 1}`, value: opt, inline: true });
  });

  const message = await interaction.channel.send({ embeds: [embed] });

  // Add reactions
  for (let i = 0; i < options.length; i++) {
    await message.react(emojis[i]);
  }

  const successEmbed = new EmbedBuilder()
    .setDescription("✅ Movie poll created!")
    .setColor(0x57F287);

  await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
}

// Set Event Live Status
async function setEventLive(interaction, data, dataPath, io) {
  const eventNumber = interaction.options.getInteger("eventnumber");
  const isLive = interaction.options.getBoolean("live");
  const joinUrl = interaction.options.getString("joinurl");

  // Validate movie_schedule exists
  if (!data.movie_schedule || !Array.isArray(data.movie_schedule)) {
    return interaction.reply({
      content: "❌ No events scheduled. Use `/movie schedule` to add events first.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Check if event number is valid
  if (eventNumber > data.movie_schedule.length) {
    return interaction.reply({
      content: `❌ Invalid event number. There are only ${data.movie_schedule.length} events scheduled. Use \`/movie upcoming\` to see the list.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Get event by index (eventNumber - 1)
  const event = data.movie_schedule[eventNumber - 1];

  // If going live, validate joinUrl is provided and valid
  if (isLive) {
    if (!joinUrl) {
      return interaction.reply({
        content: "❌ You must provide a join URL when setting an event live.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Validate URL format (Discord invite or HTTPS)
    const isDiscordInvite = joinUrl.includes('discord.gg/') || joinUrl.includes('discord.com/invite/');
    const isHttpsUrl = joinUrl.startsWith('https://');

    if (!isDiscordInvite && !isHttpsUrl) {
      return interaction.reply({
        content: "❌ Invalid URL. Must be a Discord invite (discord.gg/...) or an HTTPS URL.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Set event live
    event.isLive = true;
    event.liveJoinUrl = joinUrl;
    event.liveStartedAt = new Date().toISOString();
    event.liveStartedBy = interaction.user.id;
  } else {
    // Set event not live
    event.isLive = false;
    event.liveJoinUrl = null;
    event.liveStartedAt = null;
    event.liveStartedBy = null;
  }

  // Save changes to data.json
  saveJson(dataPath, data);

  // Emit WebSocket event for real-time frontend update
  if (io) {
    io.emit('eventLiveStatusChanged', {
      id: event.id,
      type: 'movie',
      title: event.title,
      date: event.date,
      isLive: event.isLive,
      liveJoinUrl: event.liveJoinUrl,
      liveStartedAt: event.liveStartedAt,
    });
  }

  // Create success embed
  const successEmbed = new EmbedBuilder()
    .setTitle(isLive ? "🔴 Event Set Live" : "Event Set Not Live")
    .setDescription(
      isLive
        ? `**${event.title}** is now LIVE!\n\n🔗 Join URL: ${joinUrl}`
        : `**${event.title}** is no longer live.`
    )
    .setColor(isLive ? 0xFF6B6B : 0x95A5A6)
    .setTimestamp();

  await interaction.reply({ embeds: [successEmbed] });
}

module.exports = {
  announceMovie,
  handleMovieButton,
  showSchedule,
  addToSchedule,
  removeFromSchedule,
  showStats,
  showVolumeHelp,
  createMoviePoll,
  setEventLive,
};

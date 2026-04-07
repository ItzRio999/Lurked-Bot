const { EmbedBuilder, MessageFlags } = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");
const { searchMoviePoster } = require("../utils/tmdb");
const { hasVerifiedRole, getVerifiedRoleId } = require("../utils/permissions");

function ensureMovieRequestStore(data) {
  if (!Array.isArray(data.movie_requests)) {
    data.movie_requests = [];
  }

  if (!Number.isInteger(data.movie_request_counter)) {
    data.movie_request_counter = 0;
  }
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

async function requestMovie(interaction, config, data, dataPath) {
  ensureMovieRequestStore(data);

  const title = interaction.options.getString("title", true).trim();
  const year = interaction.options.getInteger("year", true);
  const details = interaction.options.getString("details")?.trim() || null;
  const link = interaction.options.getString("link")?.trim() || null;

  if (title.length < 2) {
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("Request title is too short. Use at least 2 characters.")
        .setColor(0xED4245),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (title.length > 200) {
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription("Request title is too long. Keep it under 200 characters.")
        .setColor(0xED4245),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member);
  if (!hasVerifiedRole(member, config)) {
    const verifiedRoleId = getVerifiedRoleId(config);
    const embed = addLogo(
      new EmbedBuilder()
        .setDescription(`You need the <@&${verifiedRoleId}> role to use this command.`)
        .setColor(0xED4245),
      config
    );
    return interaction.editReply({ embeds: [embed] });
  }

  data.movie_request_counter += 1;

  const matchedMovie = await searchMoviePoster(title, year);
  const matchedGenre = matchedMovie?.genres?.length ? matchedMovie.genres.join(", ") : null;

  const movieRequest = {
    id: data.movie_request_counter,
    title,
    year,
    details,
    link,
    genre: matchedGenre,
    requester_id: interaction.user.id,
    requester_tag: interaction.user.tag,
    requester_name: interaction.user.username,
    guild_id: interaction.guildId,
    channel_id: interaction.channelId,
    created_at: new Date().toISOString(),
    status: "open",
    matched_movie: matchedMovie
      ? {
          tmdb_id: matchedMovie.tmdbId,
          title: matchedMovie.title,
          poster_url: matchedMovie.posterUrl,
          poster_url_large: matchedMovie.posterUrlLarge,
          poster_url_small: matchedMovie.posterUrlSmall,
          backdrop_url: matchedMovie.backdropUrl,
          release_date: matchedMovie.releaseDate,
          overview: matchedMovie.overview,
          runtime: matchedMovie.runtime,
          vote_average: matchedMovie.voteAverage,
          genres: matchedMovie.genres || [],
        }
      : null,
  };

  data.movie_requests.push(movieRequest);
  saveJson(dataPath, data);

  if (interaction.client?.io) {
    interaction.client.io.emit("movieRequestCreated", {
      id: movieRequest.id,
      title: movieRequest.title,
      year: movieRequest.year,
      details: movieRequest.details,
      link: movieRequest.link,
      genre: movieRequest.genre,
      status: movieRequest.status,
      requesterId: movieRequest.requester_id,
      requesterTag: movieRequest.requester_tag,
      requesterName: movieRequest.requester_name,
      requesterMention: `<@${movieRequest.requester_id}>`,
      guildId: movieRequest.guild_id,
      channelId: movieRequest.channel_id,
      createdAt: movieRequest.created_at,
      reviewedAt: null,
      reviewedBy: null,
      reviewedByEmail: null,
      adminNote: null,
      scheduledEventId: null,
      scheduledEventTitle: null,
      decisionDmSent: false,
      decisionDmError: null,
      matchedMovie: movieRequest.matched_movie
        ? {
            tmdbId: movieRequest.matched_movie.tmdb_id,
            title: movieRequest.matched_movie.title,
            posterUrl: movieRequest.matched_movie.poster_url,
            posterUrlLarge: movieRequest.matched_movie.poster_url_large,
            posterUrlSmall: movieRequest.matched_movie.poster_url_small,
            backdropUrl: movieRequest.matched_movie.backdrop_url,
            releaseDate: movieRequest.matched_movie.release_date,
            overview: movieRequest.matched_movie.overview,
            runtime: movieRequest.matched_movie.runtime,
            voteAverage: movieRequest.matched_movie.vote_average,
            genres: movieRequest.matched_movie.genres || [],
          }
        : null,
    });
  }

  const timestamp = Math.floor(new Date(movieRequest.created_at).getTime() / 1000);
  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("Movie Request Submitted")
      .setColor(0x57F287)
      .addFields(
        { name: "Request ID", value: `#${movieRequest.id}`, inline: true },
        { name: "Title", value: truncate(movieRequest.title, 1024), inline: true },
        { name: "Year", value: String(movieRequest.year), inline: true },
        { name: "Requested By", value: `<@${movieRequest.requester_id}>`, inline: true },
        { name: "Submitted", value: `<t:${timestamp}:F>`, inline: false },
        { name: "Notes", value: truncate(movieRequest.details || "None provided", 1024), inline: false }
      ),
    config
  );

  if (movieRequest.matched_movie) {
    if (movieRequest.matched_movie.poster_url) {
      embed.setThumbnail(movieRequest.matched_movie.poster_url);
    }

    embed.addFields(
      { name: "Matched Movie", value: truncate(movieRequest.matched_movie.title, 1024), inline: true },
      { name: "Genres", value: truncate(movieRequest.genre || "Unknown", 1024), inline: true },
      { name: "Runtime", value: movieRequest.matched_movie.runtime ? `${movieRequest.matched_movie.runtime} min` : "Unknown", inline: true }
    );

    if (movieRequest.matched_movie.overview) {
      embed.addFields({
        name: "Overview",
        value: truncate(movieRequest.matched_movie.overview, 1024),
        inline: false
      });
    }
  } else {
    embed.addFields({
      name: "Metadata Match",
      value: "No TMDb match found for that title/year combination.",
      inline: false
    });
  }

  if (movieRequest.link) {
    embed.addFields({ name: "Link", value: truncate(movieRequest.link, 1024), inline: false });
  }

  return interaction.editReply({ embeds: [embed] });
}

async function listMovieRequests(interaction, config, data) {
  ensureMovieRequestStore(data);

  const limit = interaction.options.getInteger("limit") || 10;
  const user = interaction.options.getUser("user");

  let requests = data.movie_requests.filter((request) => request.guild_id === interaction.guildId);

  if (user) {
    requests = requests.filter((request) => request.requester_id === user.id);
  }

  requests = requests
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  if (requests.length === 0) {
    const embed = addLogo(
      new EmbedBuilder()
        .setTitle("Movie Requests")
        .setDescription(user ? `No requests found for <@${user.id}>.` : "No movie requests have been submitted yet.")
        .setColor(0x5865F2),
      config
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("Movie Requests")
      .setColor(0x5865F2)
      .setDescription(
        user
          ? `Showing the latest ${requests.length} request(s) from <@${user.id}>.`
          : `Showing the latest ${requests.length} request(s).`
      ),
    config
  );

  for (const request of requests) {
    const timestamp = Math.floor(new Date(request.created_at).getTime() / 1000);
    const lines = [
      `Requested by <@${request.requester_id}>`,
      `Submitted <t:${timestamp}:F>`,
      `Year: ${request.year || "Unknown"}`,
      `Status: ${request.status || "open"}`,
    ];

    if (request.matched_movie?.title) {
      lines.push(`TMDb Match: ${truncate(request.matched_movie.title, 100)}`);
    }

    if (request.details) {
      lines.push(`Notes: ${truncate(request.details, 200)}`);
    }

    if (request.link) {
      lines.push(`Link: ${truncate(request.link, 200)}`);
    }

    embed.addFields({
      name: `#${request.id} - ${truncate(request.title, 200)}`,
      value: truncate(lines.join("\n"), 1024),
      inline: false,
    });
  }

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = {
  requestMovie,
  listMovieRequests,
  ensureMovieRequestStore,
};

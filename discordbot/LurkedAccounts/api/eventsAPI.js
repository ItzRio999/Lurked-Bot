const express = require('express');
const router = express.Router();
const { loadJson, saveJson, DATA_PATH } = require('../utils/fileManager');
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');
const admin = require('firebase-admin');
const { searchMoviePoster } = require('../utils/tmdb');

/**
 * Map movie genre to icon and color theme for frontend
 */
function mapGenreToTheme(genre) {
  if (!genre) {
    return {
      icon: 'solar:video-frame-play-horizontal-linear',
      color: 'violet'
    };
  }

  const genreLower = genre.toLowerCase();

  // Action, Thriller, Mystery
  if (genreLower.includes('action') || genreLower.includes('thriller') || genreLower.includes('mystery')) {
    return { icon: 'solar:clapperboard-play-linear', color: 'violet' };
  }

  // Comedy, Romance
  if (genreLower.includes('comedy') || genreLower.includes('romance')) {
    return { icon: 'solar:smile-circle-linear', color: 'amber' };
  }

  // Horror, Sci-Fi, Fantasy
  if (genreLower.includes('horror') || genreLower.includes('sci-fi') || genreLower.includes('fantasy')) {
    return { icon: 'solar:eye-linear', color: 'pink' };
  }

  // Drama, Documentary
  if (genreLower.includes('drama') || genreLower.includes('documentary')) {
    return { icon: 'solar:book-2-linear', color: 'blue' };
  }

  // Animation, Family
  if (genreLower.includes('animation') || genreLower.includes('family')) {
    return { icon: 'solar:stars-line-linear', color: 'emerald' };
  }

  // Default
  return { icon: 'solar:video-frame-play-horizontal-linear', color: 'violet' };
}

/**
 * Format ISO date to friendly display text
 */
function formatEventDate(isoDate) {
  if (!isoDate) return 'Date TBA';

  const eventDate = new Date(isoDate);
  const now = new Date();

  // Compare calendar dates by normalizing to start of day
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = eventDay - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // If in the past
  if (diffDays < 0) {
    return eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  // Today
  if (diffDays === 0) {
    return `Today at ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  // Tomorrow
  if (diffDays === 1) {
    return `Tomorrow at ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  // This week (within 7 days)
  if (diffDays <= 7) {
    const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
    const time = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dayName} at ${time}`;
  }

  // More than a week away
  return eventDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Build event description from movie data
 */
function buildEventDescription(event) {
  const parts = [];

  if (event.genre) {
    parts.push(event.genre);
  }

  if (event.runtime) {
    parts.push(event.runtime);
  }

  if (event.status === 'active' && event.metadata) {
    const { attending, maybe } = event.metadata;
    if (attending > 0 || maybe > 0) {
      const attendingText = attending === 1 ? '1 person attending' : `${attending} people attending`;
      parts.push(attendingText);
      if (maybe > 0) {
        parts.push(`${maybe} maybe`);
      }
    }
  }

  return parts.length > 0 ? parts.join(' • ') : 'Movie night event';
}

/**
 * Validate join URL for live events
 */
function validateJoinUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Allow Discord invites
  if (url.includes('discord.gg/') || url.includes('discord.com/invite/')) {
    return { valid: true };
  }

  // Allow HTTPS URLs
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return { valid: true };
    }
    return { valid: false, error: 'URL must use HTTPS protocol' };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// GET /api/events - Fetch all events (movies for now, extensible for other event types)
router.get('/api/events', async (req, res) => {
  try {
    const client = req.app.locals.client;

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready',
        events: []
      });
    }

    // Load runtime data
    const data = loadJson(DATA_PATH, {});

    const events = [];

    // Process scheduled movies from movie_schedule
    if (Array.isArray(data.movie_schedule)) {
      for (const movie of data.movie_schedule) {
        const theme = mapGenreToTheme(movie.genre);

        events.push({
          id: movie.id || `schedule_${movie.title}`,
          type: 'movie',
          title: movie.title,
          date: movie.date,
          dateFormatted: formatEventDate(movie.date),
          description: buildEventDescription({
            genre: movie.genre,
            status: 'scheduled'
          }),
          genre: movie.genre,
          status: 'scheduled',
          icon: theme.icon,
          color: theme.color,
          posterUrl: movie.posterUrl || null,
          posterUrlLarge: movie.posterUrlLarge || null,
          posterUrlSmall: movie.posterUrlSmall || null,
          isLive: movie.isLive || false,
          liveJoinUrl: movie.liveJoinUrl || null,
          liveStartedAt: movie.liveStartedAt || null,
          metadata: {
            addedBy: movie.added_by,
            addedAt: movie.added_at,
            tmdbId: movie.tmdbId || null
          }
        });
      }
    }

    // Process active announced movies from movies array
    if (Array.isArray(data.movies)) {
      for (const movie of data.movies) {
        const theme = mapGenreToTheme(movie.genre);

        // Use announced_at as the date if no specific start time
        const movieDate = movie.announced_at;

        events.push({
          id: movie.message_id,
          type: 'movie',
          title: movie.title,
          date: movieDate,
          dateFormatted: movie.time || formatEventDate(movieDate),
          description: buildEventDescription({
            genre: movie.genre,
            runtime: movie.runtime,
            status: 'active',
            metadata: {
              attending: movie.attending?.length || 0,
              maybe: movie.maybe?.length || 0
            }
          }),
          genre: movie.genre,
          runtime: movie.runtime,
          status: 'active',
          icon: theme.icon,
          color: theme.color,
          isLive: movie.isLive || false,
          liveJoinUrl: movie.liveJoinUrl || null,
          liveStartedAt: movie.liveStartedAt || null,
          metadata: {
            messageId: movie.message_id,
            channelId: movie.channel_id,
            voiceChannel: movie.voice_channel,
            attending: movie.attending?.length || 0,
            maybe: movie.maybe?.length || 0,
            reactions: movie.stats?.reactions || 0
          }
        });
      }
    }

    // Sort by date (soonest first)
    events.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    res.json({
      success: true,
      events: events,
      count: events.length
    });

  } catch (error) {
    console.error('❌ Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      events: []
    });
  }
});

// POST /api/events - Add new scheduled event (Admin only)
router.post('/api/events', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { title, date, genre } = req.body;
    const io = req.app.locals.io;

    // Validate required fields
    if (!title || !date) {
      return res.status(400).json({
        success: false,
        error: 'Title and date are required'
      });
    }

    // Validate title length
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Title must be between 3 and 100 characters'
      });
    }

    // Validate and parse date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO date string (e.g., 2026-01-30T20:00:00)'
      });
    }

    // Check if date is in the future
    if (parsedDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Event date must be in the future'
      });
    }

    // Load current data
    const data = loadJson(DATA_PATH, {});

    // Ensure movie_schedule array exists
    if (!data.movie_schedule) {
      data.movie_schedule = [];
    }

    // Fetch movie poster from TMDb (non-blocking - don't fail if it errors)
    let movieData = null;
    try {
      movieData = await searchMoviePoster(trimmedTitle);
      if (movieData) {
        console.log(`🎬 Found poster for "${trimmedTitle}": ${movieData.posterUrl}`);
      }
    } catch (tmdbError) {
      console.warn('⚠️ Failed to fetch movie poster, continuing without it:', tmdbError.message);
    }

    // Create new scheduled event
    const newEvent = {
      id: Date.now().toString(),
      title: trimmedTitle,
      date: parsedDate.toISOString(),
      genre: genre?.trim() || null,
      posterUrl: movieData?.posterUrl || null,
      posterUrlLarge: movieData?.posterUrlLarge || null,
      posterUrlSmall: movieData?.posterUrlSmall || null,
      tmdbId: movieData?.tmdbId || null,
      added_by: req.user.uid,
      added_at: new Date().toISOString()
    };

    // Add to schedule
    data.movie_schedule.push(newEvent);

    // Save to data.json
    saveJson(DATA_PATH, data);

    console.log(`✅ Event scheduled: "${trimmedTitle}" by ${req.user.email}`);

    // Emit WebSocket event for real-time update
    if (io) {
      const theme = mapGenreToTheme(newEvent.genre);
      io.emit('movieScheduleAdded', {
        id: newEvent.id,
        type: 'movie',
        title: trimmedTitle,
        date: newEvent.date,
        dateFormatted: formatEventDate(newEvent.date),
        description: buildEventDescription({ genre: newEvent.genre, status: 'scheduled' }),
        genre: newEvent.genre,
        status: 'scheduled',
        icon: theme.icon,
        color: theme.color,
        posterUrl: newEvent.posterUrl,
        posterUrlLarge: newEvent.posterUrlLarge,
        posterUrlSmall: newEvent.posterUrlSmall
      });
      console.log(`🔔 WebSocket: Emitted movieScheduleAdded event for "${trimmedTitle}"`);
    }

    // Log admin action to Firestore
    try {
      await admin.firestore().collection('adminLogs').add({
        action: 'Scheduled event',
        details: `Scheduled "${trimmedTitle}" for ${formatEventDate(newEvent.date)}`,
        adminEmail: req.user.email || 'Unknown',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
      // Don't fail the request if logging fails
    }

    // Return success with event data
    res.json({
      success: true,
      event: {
        ...newEvent,
        dateFormatted: formatEventDate(newEvent.date),
        description: buildEventDescription({ genre: newEvent.genre, status: 'scheduled' }),
        ...mapGenreToTheme(newEvent.genre),
        posterUrl: newEvent.posterUrl,
        posterUrlLarge: newEvent.posterUrlLarge,
        posterUrlSmall: newEvent.posterUrlSmall
      },
      message: 'Event scheduled successfully'
    });

  } catch (error) {
    console.error('❌ Error scheduling event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule event'
    });
  }
});

// DELETE /api/events/:eventId - Delete scheduled event (Admin only)
router.delete('/api/events/:eventId', verifyAuth, verifyAdmin, async (req, res) => {
  console.log(`🔍 DELETE request received for event ID: ${req.params.eventId}`);
  try {
    const { eventId } = req.params;
    const io = req.app.locals.io;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required'
      });
    }

    // Load current data
    const data = loadJson(DATA_PATH, {});

    if (!data.movie_schedule || !Array.isArray(data.movie_schedule)) {
      return res.status(404).json({
        success: false,
        error: 'No events found'
      });
    }

    // Find event by ID
    const eventIndex = data.movie_schedule.findIndex(event => event.id === eventId);

    if (eventIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Get event details before removing
    const removedEvent = data.movie_schedule[eventIndex];

    // Remove from schedule
    data.movie_schedule.splice(eventIndex, 1);

    // Save to data.json
    saveJson(DATA_PATH, data);

    console.log(`✅ Event deleted: "${removedEvent.title}" by ${req.user.email}`);

    // Emit WebSocket event for real-time update
    if (io) {
      io.emit('movieScheduleRemoved', {
        id: removedEvent.id,
        title: removedEvent.title
      });
      console.log(`🔔 WebSocket: Emitted movieScheduleRemoved event for "${removedEvent.title}"`);
    }

    // Log admin action to Firestore
    try {
      await admin.firestore().collection('adminLogs').add({
        action: 'Deleted event',
        details: `Deleted "${removedEvent.title}"`,
        adminEmail: req.user.email || 'Unknown',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
      // Don't fail the request if logging fails
    }

    res.json({
      success: true,
      message: 'Event deleted successfully',
      event: {
        id: removedEvent.id,
        title: removedEvent.title
      }
    });

  } catch (error) {
    console.error('❌ Error deleting event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event'
    });
  }
});

// PATCH /api/events/:eventId/live - Set event live status (Admin only)
router.patch('/api/events/:eventId/live', verifyAuth, verifyAdmin, async (req, res) => {
  console.log(`🔍 PATCH request received for event ID: ${req.params.eventId}`);
  try {
    const { eventId } = req.params;
    const { isLive, liveJoinUrl } = req.body;
    const io = req.app.locals.io;

    // Validate eventId
    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required'
      });
    }

    // Validate isLive is a boolean
    if (typeof isLive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isLive must be a boolean value'
      });
    }

    // If going live, validate the join URL
    if (isLive) {
      const urlValidation = validateJoinUrl(liveJoinUrl);
      if (!urlValidation.valid) {
        return res.status(400).json({
          success: false,
          error: urlValidation.error || 'Invalid join URL'
        });
      }
    }

    // Load current data
    const data = loadJson(DATA_PATH, {});

    let event = null;
    let eventLocation = null;

    // Try to find event in movie_schedule
    if (Array.isArray(data.movie_schedule)) {
      const scheduleIndex = data.movie_schedule.findIndex(e => e.id === eventId);
      if (scheduleIndex !== -1) {
        event = data.movie_schedule[scheduleIndex];
        eventLocation = { array: 'movie_schedule', index: scheduleIndex };
      }
    }

    // If not found, try movies array
    if (!event && Array.isArray(data.movies)) {
      const moviesIndex = data.movies.findIndex(e => e.message_id === eventId);
      if (moviesIndex !== -1) {
        event = data.movies[moviesIndex];
        eventLocation = { array: 'movies', index: moviesIndex };
      }
    }

    // Event not found
    if (!event || !eventLocation) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Update live status
    if (isLive) {
      event.isLive = true;
      event.liveJoinUrl = liveJoinUrl;
      event.liveStartedAt = new Date().toISOString();
      event.liveStartedBy = req.user.uid;
    } else {
      event.isLive = false;
      event.liveJoinUrl = null;
      event.liveStartedAt = null;
      event.liveStartedBy = null;
    }

    // Update the event in the data structure
    if (eventLocation.array === 'movie_schedule') {
      data.movie_schedule[eventLocation.index] = event;
    } else {
      data.movies[eventLocation.index] = event;
    }

    // Save to data.json
    saveJson(DATA_PATH, data);

    console.log(`✅ Event live status updated: "${event.title}" → ${isLive ? 'LIVE' : 'NOT LIVE'} by ${req.user.email}`);

    // Build full event object for WebSocket
    const theme = mapGenreToTheme(event.genre);
    const fullEventData = {
      id: eventId,
      type: 'movie',
      title: event.title,
      date: event.date || event.announced_at,
      dateFormatted: event.time || formatEventDate(event.date || event.announced_at),
      description: buildEventDescription({
        genre: event.genre,
        runtime: event.runtime,
        status: eventLocation.array === 'movie_schedule' ? 'scheduled' : 'active'
      }),
      genre: event.genre,
      status: eventLocation.array === 'movie_schedule' ? 'scheduled' : 'active',
      icon: theme.icon,
      color: theme.color,
      posterUrl: event.posterUrl || null,
      isLive: event.isLive,
      liveJoinUrl: event.liveJoinUrl,
      liveStartedAt: event.liveStartedAt
    };

    // Emit WebSocket event for real-time update
    if (io) {
      io.emit('eventLiveStatusChanged', fullEventData);
      console.log(`🔔 WebSocket: Emitted eventLiveStatusChanged event for "${event.title}"`);
    }

    // Log admin action to Firestore
    try {
      await admin.firestore().collection('adminLogs').add({
        action: isLive ? 'Set event live' : 'Set event not live',
        details: isLive
          ? `Set "${event.title}" as LIVE with join URL: ${liveJoinUrl}`
          : `Set "${event.title}" as no longer live`,
        adminEmail: req.user.email || 'Unknown',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
      // Don't fail the request if logging fails
    }

    // Return success with updated event
    res.json({
      success: true,
      event: fullEventData,
      message: isLive ? 'Event is now live' : 'Event is no longer live'
    });

  } catch (error) {
    console.error('❌ Error updating event live status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event live status'
    });
  }
});

// Test endpoint to verify router is working
router.get('/api/events/health', (req, res) => {
  res.json({
    success: true,
    message: 'Events API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

const fetch = require('node-fetch');

/**
 * TMDb API utility for fetching movie metadata
 * Get your free API key from: https://www.themoviedb.org/settings/api
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Search for a movie by title and return poster URL
 * @param {string} title - Movie title to search for
 * @returns {Promise<object|null>} - Movie data with poster URL, or null if not found
 */
async function searchMoviePoster(title) {
  // If no API key configured, return null (graceful degradation)
  if (!TMDB_API_KEY) {
    console.warn('⚠️ TMDb API key not configured. Movie posters will not be fetched.');
    return null;
  }

  try {
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.error(`❌ TMDb API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // If no results found
    if (!data.results || data.results.length === 0) {
      console.log(`ℹ️ No TMDb results found for "${title}"`);
      return null;
    }

    // Get the first (most relevant) result
    const movie = data.results[0];

    // Check if movie has a poster
    if (!movie.poster_path) {
      console.log(`ℹ️ No poster available for "${title}" (TMDb ID: ${movie.id})`);
      return null;
    }

    // Return movie data with poster URLs in different sizes
    return {
      tmdbId: movie.id,
      title: movie.title,
      posterUrl: `${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}`, // Medium quality for cards
      posterUrlLarge: `${TMDB_IMAGE_BASE_URL}/w780${movie.poster_path}`, // High quality for modals
      posterUrlSmall: `${TMDB_IMAGE_BASE_URL}/w342${movie.poster_path}`, // Small for thumbnails
      releaseDate: movie.release_date,
      overview: movie.overview,
      voteAverage: movie.vote_average
    };

  } catch (error) {
    console.error('❌ Error fetching movie poster from TMDb:', error.message);
    return null;
  }
}

/**
 * Get movie details by TMDb ID
 * @param {number} tmdbId - TMDb movie ID
 * @returns {Promise<object|null>} - Movie data or null if not found
 */
async function getMovieById(tmdbId) {
  if (!TMDB_API_KEY) {
    return null;
  }

  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const movie = await response.json();

    return {
      tmdbId: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}` : null,
      posterUrlLarge: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w780${movie.poster_path}` : null,
      posterUrlSmall: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${movie.poster_path}` : null,
      backdropUrl: movie.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/original${movie.backdrop_path}` : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      runtime: movie.runtime,
      voteAverage: movie.vote_average,
      genres: movie.genres?.map(g => g.name) || []
    };

  } catch (error) {
    console.error('❌ Error fetching movie by ID from TMDb:', error.message);
    return null;
  }
}

module.exports = {
  searchMoviePoster,
  getMovieById
};

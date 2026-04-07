const fetch = require('node-fetch');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

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
      genres: movie.genres?.map((genre) => genre.name) || []
    };
  } catch (error) {
    console.error('Error fetching movie by ID from TMDb:', error.message);
    return null;
  }
}

async function searchMoviePoster(title, year = null) {
  if (!TMDB_API_KEY) {
    console.warn('TMDb API key not configured. Movie posters will not be fetched.');
    return null;
  }

  try {
    const yearParam = Number.isInteger(year) ? `&year=${year}` : '';
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1${yearParam}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.error(`TMDb API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log(`No TMDb results found for "${title}"`);
      return null;
    }

    const movie = data.results[0];
    const detailedMovie = await getMovieById(movie.id);

    return {
      tmdbId: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}` : null,
      posterUrlLarge: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w780${movie.poster_path}` : null,
      posterUrlSmall: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${movie.poster_path}` : null,
      backdropUrl: detailedMovie?.backdropUrl || null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      runtime: detailedMovie?.runtime || null,
      voteAverage: movie.vote_average,
      genres: detailedMovie?.genres || []
    };
  } catch (error) {
    console.error('Error fetching movie poster from TMDb:', error.message);
    return null;
  }
}

module.exports = {
  searchMoviePoster,
  getMovieById
};

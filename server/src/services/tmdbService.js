const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

function serviceError(status, message) {
  const error = new Error(message);

  error.status = status;
  error.isOperational = true;

  return error;
}

// Shared helper for server-side TMDB requests.
export async function tmdbRequest(path, parameters = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();

  if (!token) {
    throw serviceError(
      503,
      "TMDB integration is not configured on the server.",
    );
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401 || response.status === 403) {
      throw serviceError(
        502,
        "TMDB rejected the server credentials. Check TMDB_ACCESS_TOKEN.",
      );
    }

    if (response.status === 429) {
      throw serviceError(
        503,
        "TMDB is receiving too many requests. Try again shortly.",
      );
    }

    if (response.status === 404) {
      throw serviceError(
        404,
        "The requested movie could not be found on TMDB.",
      );
    }

    if (!response.ok) {
      throw serviceError(502, "TMDB could not complete the request.");
    }

    return await response.json();
  } catch (error) {
    // Preserve errors we deliberately created above.
    if (error.isOperational) {
      throw error;
    }

    if (error.name === "TimeoutError") {
      throw serviceError(504, "TMDB took too long to respond. Try again.");
    }

    throw serviceError(
      502,
      "Could not communicate with TMDB. Try again later.",
    );
  }
}

export async function searchTmdbMovies(query, page = 1) {
  const data = await tmdbRequest("/search/movie", {
    query,
    page,
    language: "en-US",
    include_adult: false,
  });

  if (!Array.isArray(data.results)) {
    throw serviceError(502, "TMDB returned an unexpected response.");
  }

  return {
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
    totalResults: data.total_results,

    results: data.results.map((movie) => ({
      tmdbId: movie.id,
      title: movie.title,

      releaseDate: movie.release_date || null,

      rating: movie.vote_count > 0 ? movie.vote_average : null,

      posterPreviewUrl: movie.poster_path
        ? `${TMDB_IMAGE_URL}${movie.poster_path}`
        : null,
    })),
  };
}

export async function getTmdbMovieDetails(tmdbId) {
  const movie = await tmdbRequest(`/movie/${tmdbId}`, {
    language: "en-US",
  });

  if (
    movie.id !== tmdbId ||
    typeof movie.title !== "string" ||
    !Array.isArray(movie.genres)
  ) {
    throw serviceError(502, "TMDB returned unexpected movie details.");
  }

  return movie;
}

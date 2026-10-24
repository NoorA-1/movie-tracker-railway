import { randomUUID } from "node:crypto";

import Movie from "../models/Movie.js";
import { createMovieSchema } from "../validators/movieValidator.js";
import { importMovieSchema } from "../validators/tmdbValidator.js";
import { getTmdbMovieDetails } from "../services/tmdbService.js";

export async function importMovie(req, res) {
  const input = importMovieSchema.parse(req.body);

  const existing = await Movie.findOne({
    tmdbId: input.tmdbId,
  });

  if (existing) {
    return res.status(409).json({
      error: {
        message: "This TMDB movie is already in your collection.",
      },
    });
  }

  const details = await getTmdbMovieDetails(input.tmdbId);

  if (!details.release_date) {
    return res.status(422).json({
      error: {
        message:
          "This movie has no release date on TMDB. Add it manually with a known release date.",
      },
    });
  }

  const validation = createMovieSchema.safeParse({
    title: details.title,
    releaseDate: details.release_date,
    rating: details.vote_count > 0 ? details.vote_average : null,
    genres: details.genres.map((genre) => genre.name),
    status: input.status,
    favorite: input.favorite,
  });

  if (!validation.success) {
    return res.status(422).json({
      error: {
        message: "This TMDB movie could not be imported. Add it manually.",
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join(".") || "movie",
          message: issue.message,
        })),
      },
    });
  }

  const hasPoster =
    typeof details.poster_path === "string" && details.poster_path.length > 0;

  const movie = await Movie.create({
    ...validation.data,
    source: "tmdb",
    tmdbId: input.tmdbId,
    posterUrl: null,
    posterKey: null,
    posterStatus: hasPoster ? "pending" : "none",
    posterJobId: hasPoster ? randomUUID() : null,
  });

  res.status(201).location(`/api/movies/${movie.id}`).json({ movie });
}

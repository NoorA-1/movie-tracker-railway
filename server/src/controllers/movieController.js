import Movie from "../models/Movie.js";

import {
  createMovieSchema,
  updateMovieSchema,
  listMoviesSchema,
} from "../validators/movieValidator.js";

import mongoose from "mongoose";
import { scheduleObjectDeletion } from "../services/storageCleanupService.js";

// POST /api/movies
export async function createMovie(req, res) {
  const data = createMovieSchema.parse(req.body);

  const movie = await Movie.create(data);

  res.location(`/api/movies/${movie.id}`).status(201).json({ movie });
}

// GET /api/movies
export async function getMovies(req, res) {
  const { search, status, favorite, page, limit } = listMoviesSchema.parse(
    req.query,
  );

  const filter = {};

  if (search) {
    // Escape special characters so searches are literal text.
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.title = {
      $regex: escapedSearch,
      $options: "i",
    };
  }

  if (status) {
    filter.status = status;
  }

  // Explicitly check undefined because false is a valid filter.
  if (favorite !== undefined) {
    filter.favorite = favorite;
  }

  const skip = (page - 1) * limit;

  const [movies, total] = await Promise.all([
    Movie.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),

    Movie.countDocuments(filter),
  ]);

  res.json({
    movies,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

// GET /api/movies/:id
export async function getMovieById(req, res) {
  const movie = await Movie.findById(req.params.id);

  if (!movie) {
    return res.status(404).json({
      error: {
        message: "Movie not found",
      },
    });
  }

  res.json({ movie });
}

// PATCH /api/movies/:id
export async function updateMovie(req, res) {
  const data = updateMovieSchema.parse(req.body);

  const movie = await Movie.findByIdAndUpdate(
    req.params.id,
    {
      $set: data,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!movie) {
    return res.status(404).json({
      error: {
        message: "Movie not found",
      },
    });
  }

  res.json({ movie });
}

// DELETE /api/movies/:id
export async function deleteMovie(req, res) {
  const movie = await mongoose.connection.transaction(async (session) => {
    const deleted = await Movie.findByIdAndDelete(req.params.id, {
      session,
    });

    if (!deleted) {
      return null;
    }

    await scheduleObjectDeletion(deleted.posterKey, { session });
    await scheduleObjectDeletion(deleted.posterInputKey, { session });

    return deleted;
  });

  if (!movie) {
    return res.status(404).json({
      error: { message: "Movie not found." },
    });
  }

  res.status(204).end();
}

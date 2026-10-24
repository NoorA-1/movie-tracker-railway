import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import Movie from "../models/Movie.js";
import { inspectPoster } from "../services/imageService.js";
import { uploadObject } from "../services/storageService.js";
import {
  scheduleObjectDeletion,
  keepUploadedObject,
} from "../services/storageCleanupService.js";

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.isOperational = true;
  return error;
}

export async function uploadPoster(req, res) {
  if (!req.file) {
    throw requestError(400, "Choose a poster image to upload.");
  }

  const exists = await Movie.exists({ _id: req.params.movieId });

  if (!exists) {
    throw requestError(404, "Movie not found.");
  }

  let metadata;

  try {
    metadata = await inspectPoster(req.file.buffer);
  } catch {
    throw requestError(
      422,
      "Use a valid, non-animated JPEG, PNG, or WebP image up to 10 MB and 40 megapixels.",
    );
  }

  const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
  const key = `uploads/${req.params.movieId}/${randomUUID()}.${extension}`;
  const jobId = randomUUID();

  await scheduleObjectDeletion(key, {
    delayMs: 60 * 60 * 1000,
  });

  await uploadObject({
    key,
    body: req.file.buffer,
    contentType: `image/${metadata.format}`,
    cacheControl: "no-store",
  });

  const movie = await mongoose.connection.transaction(async (session) => {
    const current = await Movie.findById(req.params.movieId).session(session);

    if (!current) {
      throw requestError(404, "Movie not found.");
    }

    await keepUploadedObject(key, session);

    await scheduleObjectDeletion(current.posterInputKey, {
      session,
    });

    current.posterInputKey = key;
    current.posterJobId = jobId;
    current.posterStatus = "pending";

    // Keep the displayed poster until the replacement is ready.
    await current.save({ session });

    return current;
  });

  res.status(202).json({ movie });
}

export async function removePoster(req, res) {
  const movie = await mongoose.connection.transaction(async (session) => {
    const current = await Movie.findById(req.params.movieId).session(session);

    if (!current) {
      throw requestError(404, "Movie not found.");
    }

    await scheduleObjectDeletion(current.posterKey, { session });
    await scheduleObjectDeletion(current.posterInputKey, { session });

    current.posterKey = null;
    current.posterUrl = null;
    current.posterInputKey = null;
    current.posterJobId = null;
    current.posterStatus = "none";

    await current.save({ session });

    return current;
  });

  res.json({ movie });
}

export async function retryPoster(req, res) {
  const movie = await Movie.findOneAndUpdate(
    {
      _id: req.params.movieId,
      posterStatus: "failed",
      $or: [
        { posterInputKey: { $type: "string" } },
        {
          source: "tmdb",
          tmdbId: { $type: "number" },
        },
      ],
    },
    {
      $set: {
        posterStatus: "pending",
        posterJobId: randomUUID(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!movie) {
    const exists = await Movie.exists({ _id: req.params.movieId });

    throw requestError(
      exists ? 409 : 404,
      exists
        ? "This movie does not have a failed poster request to retry."
        : "Movie not found.",
    );
  }

  res.status(202).json({ movie });
}

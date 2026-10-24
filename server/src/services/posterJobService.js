import { randomUUID } from "node:crypto";

import Movie from "../models/Movie.js";
import { getTmdbMovieDetails } from "./tmdbService.js";
import { processPoster } from "./imageService.js";
import { uploadObject, downloadObject } from "./storageService.js";

import mongoose from "mongoose";

import {
  scheduleObjectDeletion,
  keepUploadedObject,
} from "./storageCleanupService.js";

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const ACTIVE_STATUSES = ["pending", "processing"];

export async function syncPosterJobs(queue) {
  const movies = await Movie.find({
    posterStatus: { $in: ACTIVE_STATUSES },
    posterJobId: { $type: "string" },
  })
    .select("_id posterJobId")
    .sort({ updatedAt: 1 })
    .limit(100)
    .lean();

  for (const movie of movies) {
    const existingJob = await queue.getJob(movie.posterJobId);

    if (!existingJob) {
      await queue.add(
        "process-poster",
        {
          movieId: movie._id.toString(),
        },
        {
          jobId: movie.posterJobId,
        },
      );

      console.log(`Queued poster for movie ${movie._id}`);
      continue;
    }

    const state = await existingJob.getState();

    if (state === "failed") {
      await Movie.updateOne(
        {
          _id: movie._id,
          posterJobId: movie.posterJobId,
          posterStatus: { $in: ACTIVE_STATUSES },
        },
        {
          $set: {
            posterStatus: "failed",
          },
        },
      );
    }
  }
}

async function downloadTmdbPoster(posterPath) {
  // Accept a TMDB image filename, never an arbitrary URL.
  if (
    typeof posterPath !== "string" ||
    !/^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(posterPath)
  ) {
    throw new Error("TMDB returned an invalid poster path");
  }

  const response = await fetch(`https://image.tmdb.org/t/p/w780${posterPath}`, {
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Poster download failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Poster download returned an empty response");
  }

  const declaredSize = Number(response.headers.get("content-length"));

  if (declaredSize > MAX_DOWNLOAD_BYTES) {
    await response.body.cancel();
    throw new Error("Poster download exceeds 10 MB");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error("Poster download exceeds 10 MB");
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

export async function processPosterJob(job) {
  const currentRequest = {
    _id: job.data.movieId,
    posterJobId: job.id,
    posterStatus: { $in: ACTIVE_STATUSES },
  };

  const movie = await Movie.findOneAndUpdate(
    currentRequest,
    {
      $set: {
        posterStatus: "processing",
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!movie) {
    return { skipped: true };
  }

  let original;

  if (movie.posterInputKey) {
    original = await downloadObject(movie.posterInputKey);
  } else {
    if (movie.source !== "tmdb" || !movie.tmdbId) {
      throw new Error("No source image is available for this poster");
    }

    const details = await getTmdbMovieDetails(movie.tmdbId);

    if (!details.poster_path) {
      await Movie.updateOne(currentRequest, {
        $set: {
          posterStatus: movie.posterKey ? "ready" : "none",
        },
      });

      return { noPoster: true };
    }

    original = await downloadTmdbPoster(details.poster_path);
  }

  const processed = await processPoster(original);
  const key = `posters/${movie.id}/${randomUUID()}.webp`;

  await scheduleObjectDeletion(key, {
    delayMs: 60 * 60 * 1000,
  });

  const uploaded = await uploadObject({
    key,
    body: processed.buffer,
    contentType: processed.contentType,
  });

  const attached = await mongoose.connection.transaction(async (session) => {
    const current = await Movie.findOne({
      _id: movie._id,
      posterJobId: job.id,
      posterStatus: "processing",
    }).session(session);

    if (!current) {
      return false;
    }

    await keepUploadedObject(uploaded.key, session);

    await scheduleObjectDeletion(current.posterKey, { session });
    await scheduleObjectDeletion(current.posterInputKey, { session });

    current.posterKey = uploaded.key;
    current.posterUrl = uploaded.url;
    current.posterInputKey = null;
    current.posterStatus = "ready";

    await current.save({ session });

    return true;
  });

  if (!attached) {
    // The cleanup reservation will remove this abandoned output.
    return { skipped: true };
  }

  console.log(
    `Poster ready: ${movie.title} — ${processed.width}x${processed.height}`,
  );

  return {
    movieId: movie.id,
    posterUrl: uploaded.url,
  };
}

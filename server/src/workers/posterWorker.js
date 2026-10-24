import mongoose from "mongoose";
import { Worker } from "bullmq";

import { connectDB } from "../config/db.js";
import { getR2Storage } from "../config/r2.js";
import { createPosterQueue, POSTER_QUEUE_NAME } from "../queues/posterQueue.js";
import {
  syncPosterJobs,
  processPosterJob,
} from "../services/posterJobService.js";
import StorageCleanup from "../models/StorageCleanup.js";
import { cleanUnusedObjects } from "../services/storageCleanupService.js";

async function startWorker() {
  if (!process.env.TMDB_ACCESS_TOKEN?.trim()) {
    throw new Error("TMDB_ACCESS_TOKEN is missing from your .env file");
  }

  const { client: r2Client } = getR2Storage();

  await connectDB();
  await StorageCleanup.init();

  const { queue, connection } = await createPosterQueue({
    forWorker: true,
  });

  const worker = new Worker(
    POSTER_QUEUE_NAME,
    async (job) => {
      console.log(`Starting job ${job.id}: ${job.name}`);

      if (job.name === "connection-check") {
        console.log("Received message:", job.data.message);
        return { message: "Queue connection works." };
      }

      if (job.name === "process-poster" || job.name === "process-tmdb-poster") {
        return processPosterJob(job);
      }

      throw new Error(`Unsupported job type: ${job.name}`);
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id ?? "unknown"} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error.message);
  });

  let stopping = false;
  let syncInProgress = null;
  let syncTimer = null;

  function synchronize() {
    if (stopping || syncInProgress) {
      return syncInProgress;
    }
    syncInProgress = syncPosterJobs(queue)
      .then(() => cleanUnusedObjects())
      .catch((error) => {
        console.error("Background maintenance failed:", error.message);
      })
      .finally(() => {
        syncInProgress = null;
      });

    return syncInProgress;
  }

  async function shutdown() {
    if (stopping) {
      return;
    }

    stopping = true;
    clearInterval(syncTimer);

    console.log("Stopping poster worker...");

    const timeout = setTimeout(() => {
      console.error("Worker shutdown timed out");
      process.exit(1);
    }, 90_000);

    timeout.unref();

    try {
      await syncInProgress;
      await worker.close();
      await queue.close();

      connection.disconnect();

      await mongoose.disconnect();
      r2Client.destroy();

      clearTimeout(timeout);
      console.log("Poster worker stopped");
    } catch (error) {
      console.error("Worker shutdown failed:", error.message);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await worker.waitUntilReady();

  if (stopping) {
    return;
  }

  console.log("Poster worker ready. Checking for poster requests...");

  syncTimer = setInterval(synchronize, 5000);
  await synchronize();
}

startWorker().catch((error) => {
  console.error("Worker startup failed:", error.message);
  process.exit(1);
});

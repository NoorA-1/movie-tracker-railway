import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis.js";

export const POSTER_QUEUE_NAME = "poster-processing";

export async function createPosterQueue({ forWorker = false } = {}) {
  const connection = await createRedisConnection({ forWorker });

  const queue = new Queue(POSTER_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: false,
    },
  });

  queue.on("error", (error) => {
    console.error("Poster queue error:", error.message);
  });

  return { queue, connection };
}

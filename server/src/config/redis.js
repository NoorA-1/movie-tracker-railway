import Redis from "ioredis";

export async function createRedisConnection({ forWorker = false } = {}) {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is missing from your .env file");
  }

  const connection = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 10000,

    // Workers can wait for Redis to recover.
    // Producers should report failures promptly.
    maxRetriesPerRequest: forWorker ? null : 1,

    enableOfflineQueue: forWorker,

    retryStrategy: forWorker
      ? (attempt) => Math.min(attempt * 500, 5000)
      : () => null,
  });

  connection.on("error", (error) => {
    console.error("Redis connection error:", error.message);
  });

  try {
    await connection.connect();
    return connection;
  } catch (error) {
    connection.disconnect();
    throw error;
  }
}

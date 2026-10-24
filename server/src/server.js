import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import Movie from "./models/Movie.js";
import StorageCleanup from "./models/StorageCleanup.js";

const PORT = Number(process.env.PORT || 4000);
const HOST =
  process.env.HOST ||
  (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

async function startServer() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  // Connect MongoDB before accepting API requests.
  await connectDB();

  // Ensure the model's indexes exist before accepting requests.
  await Movie.init();
  await StorageCleanup.init();

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });

  server.on("error", async (error) => {
    console.error("Server could not start:", error.code);

    await mongoose.disconnect();

    process.exitCode = 1;
  });

  // Close connections cleanly when the process stops.
  let shuttingDown = false;

  function shutdown() {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log("Shutting down server...");

    const timeout = setTimeout(() => {
      process.exit(1);
    }, 10000);

    timeout.unref();

    server.close(async () => {
      try {
        await mongoose.disconnect();
        clearTimeout(timeout);
        process.exitCode = 0;
      } catch {
        console.error("Could not close the database connection");
        process.exit(1);
      }
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exitCode = 1;
});

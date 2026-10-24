import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import Movie from "../models/Movie.js";

async function main() {
  await connectDB();

  try {
    const eligible = {
      source: "tmdb",
      tmdbId: { $type: "number" },
      posterUrl: null,
      posterStatus: { $in: ["none", "failed"] },
    };

    const cursor = Movie.find(eligible).select("_id title").lean().cursor();

    let requested = 0;

    for await (const movie of cursor) {
      const result = await Movie.updateOne(
        {
          ...eligible,
          _id: movie._id,
        },
        {
          $set: {
            posterStatus: "pending",
            posterJobId: randomUUID(),
          },
        },
      );

      if (result.modifiedCount === 1) {
        requested += 1;
        console.log(`Requested poster: ${movie.title}`);
      }
    }

    console.log(`Requested ${requested} poster(s).`);
    console.log("Keep npm run worker running to process them.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Poster backfill failed:", error.message);
  process.exitCode = 1;
});

import { Router } from "express";
import mongoose from "mongoose";

import Movie from "../models/Movie.js";
import { downloadObject } from "../services/storageService.js";

const router = Router();

router.get(/^\/posters\/(.+)$/, async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: { message: "Database is unavailable." },
    });
  }

  const key = `posters/${req.params[0]}`;

  // The worker produces WebP posters.
  if (
    key.length > 512 ||
    !/^[a-zA-Z0-9/_\-.]+\.webp$/.test(key) ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return res.status(400).json({
      error: { message: "Invalid poster key." },
    });
  }

  try {
    // Only expose posters attached to movies.
    const movieExists = await Movie.exists({ posterKey: key });

    if (!movieExists) {
      return res.status(404).json({
        error: { message: "Poster not found." },
      });
    }

    const image = await downloadObject(key);

    res.set("Cache-Control", "public, max-age=3600");
    res.type("webp").send(image);
  } catch (error) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({
        error: { message: "Poster file not found." },
      });
    }

    next(error);
  }
});

export default router;

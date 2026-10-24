import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";

import {
  uploadPoster,
  removePoster,
  retryPoster,
} from "../controllers/posterController.js";

const router = Router();

const receiveFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 2,
  },
}).single("poster");

router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: { message: "Database is unavailable." },
    });
  }

  next();
});

router.param("movieId", (req, res, next, value) => {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    return res.status(400).json({
      error: { message: "Invalid movie ID." },
    });
  }

  next();
});

function receivePoster(req, res, next) {
  if (!req.is("multipart/form-data")) {
    return res.status(415).json({
      error: { message: "Upload the poster using multipart/form-data." },
    });
  }

  receiveFile(req, res, (error) => {
    if (error) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";

      return res.status(tooLarge ? 413 : 400).json({
        error: {
          message: tooLarge
            ? "Poster image must be 10 MB or smaller."
            : "Upload one image using the field name 'poster'.",
        },
      });
    }

    next();
  });
}

router.post("/:movieId/poster", receivePoster, uploadPoster);
router.delete("/:movieId/poster", removePoster);
router.post("/:movieId/poster/retry", retryPoster);

export default router;

import { Router } from "express";

import {
  createMovie,
  getMovies,
  getMovieById,
  updateMovie,
  deleteMovie,
} from "../controllers/movieController.js";
import { importMovie } from "../controllers/importController.js";

const router = Router();

// Creation and updates require JSON request bodies.
router.use((req, res, next) => {
  const requiresJson = ["POST", "PATCH"].includes(req.method);

  if (requiresJson && !req.is("application/json")) {
    return res.status(415).json({
      error: {
        message: "Use Content-Type: application/json",
      },
    });
  }

  next();
});

// Validate any route parameter named "id".
router.param("id", (req, res, next, id) => {
  const isValidId = /^[a-fA-F0-9]{24}$/.test(id);

  if (!isValidId) {
    return res.status(400).json({
      error: {
        message: "Invalid movie ID",
      },
    });
  }

  next();
});

router.post("/import", importMovie);

router.route("/").get(getMovies).post(createMovie);

router.route("/:id").get(getMovieById).patch(updateMovie).delete(deleteMovie);

export default router;

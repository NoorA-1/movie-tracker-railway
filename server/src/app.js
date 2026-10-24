import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { ZodError } from "zod";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./config/swagger.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import movieRoutes from "./routes/movieRoutes.js";
import tmdbRoutes from "./routes/tmdbRoutes.js";
import posterRoutes from "./routes/posterRoutes.js";

const app = express();

app.disable("x-powered-by");

// Treat query parameters as simple strings.
app.set("query parser", "simple");

const imageSources = ["'self'", "data:", "https://image.tmdb.org"];

if (process.env.R2_PUBLIC_BASE_URL) {
  imageSources.push(new URL(process.env.R2_PUBLIC_BASE_URL.trim()).origin);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: imageSources,
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);

app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:5173",
  }),
);

app.use(
  express.json({
    limit: "32kb",
  }),
);

// Serve the OpenAPI document as JSON.
app.get("/api/openapi.json", (req, res) => {
  res.json(swaggerDocument);
});

// Serve the interactive documentation.
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Movie Tracker API Docs",
    swaggerOptions: {
      validatorUrl: null,
    },
  }),
);

// API and database readiness.
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

app.use("/api/movies", posterRoutes);

// Movie endpoints.
app.use(
  "/api/movies",

  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: {
          message: "Database unavailable",
        },
      });
    }

    next();
  },

  movieRoutes,
);

// External movie search.
app.use("/api/tmdb", tmdbRoutes);

if (process.env.NODE_ENV === "production") {
  const clientDirectory = fileURLToPath(
    new URL("../../client/dist/", import.meta.url),
  );

  const indexFile = new URL("../../client/dist/index.html", import.meta.url);

  if (!existsSync(indexFile)) {
    throw new Error(
      "React build is missing. Build the client before starting production.",
    );
  }

  app.use(express.static(clientDirectory));
}

// Unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
    },
  });
});

// Central error handler.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // Invalid request fields.
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: error.issues.map((issue) => ({
          field: issue.path.join(".") || "request",
          message: issue.message,
        })),
      },
    });
  }

  // Malformed JSON.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        message: "Invalid JSON body",
      },
    });
  }

  // JSON body exceeds the configured size limit.
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: {
        message: "Request body too large",
      },
    });
  }

  // Database schema validation or conversion errors.
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      error: {
        message: "Invalid movie data",
      },
    });
  }

  // Expected service errors with messages safe to return to clients.
  if (
    error.isOperational === true &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return res.status(error.status).json({
      error: {
        message: error.message,
      },
    });
  }

  console.error("Request failed:", error.name);

  if (error.code === 11000 && error.keyPattern?.tmdbId) {
    return res.status(409).json({
      error: {
        message: "This TMDB movie is already in your collection.",
      },
    });
  }

  res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
});

export default app;

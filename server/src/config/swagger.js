// Fields users can supply when creating or updating a movie.
const movieFields = {
  title: {
    type: "string",
    minLength: 1,
    maxLength: 120,
    description: "Movie title. Leading and trailing spaces are removed.",
    example: "Interstellar",
  },

  releaseDate: {
    type: "string",
    format: "date",
    description: "A real calendar date in YYYY-MM-DD format.",
    example: "2014-11-07",
  },

  rating: {
    type: "number",
    minimum: 0,
    maximum: 10,
    nullable: true,
    description: "Use null for an unrated movie.",
    example: 8.7,
  },

  genres: {
    type: "array",
    maxItems: 10,
    items: {
      type: "string",
      minLength: 1,
      maxLength: 50,
    },
    example: ["Adventure", "Drama", "Science Fiction"],
  },

  status: {
    type: "string",
    enum: ["want-to-watch", "watching", "watched"],
    example: "want-to-watch",
  },

  favorite: {
    type: "boolean",
    example: false,
  },
};

// Example used by Swagger's "Try it out" form.
const createExample = {
  title: "Interstellar",
  releaseDate: "2014-11-07",
  rating: 8.7,
  genres: ["Adventure", "Drama", "Science Fiction"],
  status: "want-to-watch",
  favorite: false,
};

// Reusable helper for JSON responses.
function jsonResponse(description, schema) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

// Reusable helper for JSON request bodies.
function jsonBody(schemaName, example) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
        example,
      },
    },
  };
}

// Reusable error response.
function errorResponse(description) {
  return jsonResponse(description, {
    $ref: "#/components/schemas/Error",
  });
}

// Every single-movie response uses { movie: ... }.
const singleMovieResponse = {
  type: "object",
  properties: {
    movie: {
      $ref: "#/components/schemas/Movie",
    },
  },
};

const swaggerDocument = {
  openapi: "3.0.3",

  info: {
    title: "Movie Tracker API",
    version: "1.0.0",
    description:
      "API for creating, viewing, updating, and deleting movies. " +
      "The current version manages one shared collection.",
  },

  // Use the same server that serves the documentation.
  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],

  tags: [
    {
      name: "Health",
      description: "API and database readiness",
    },
    {
      name: "Movies",
      description: "Movie collection operations",
    },
    {
      name: "TMDB",
      description: "Search external movie information",
    },
  ],

  paths: {
    "/api/tmdb/search": {
      get: {
        tags: ["TMDB"],
        summary: "Search TMDB for movies",
        description:
          "Searches external movie data. Results are not saved to the collection.",

        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120,
            },
            example: "interstellar",
          },
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 1,
            },
          },
        ],

        responses: {
          200: jsonResponse("TMDB search results", {
            type: "object",
            properties: {
              page: {
                type: "integer",
              },
              totalPages: {
                type: "integer",
              },
              totalResults: {
                type: "integer",
              },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tmdbId: {
                      type: "integer",
                    },
                    title: {
                      type: "string",
                    },
                    releaseDate: {
                      type: "string",
                      format: "date",
                      nullable: true,
                    },
                    rating: {
                      type: "number",
                      nullable: true,
                    },
                    posterPreviewUrl: {
                      type: "string",
                      format: "uri",
                      nullable: true,
                    },
                  },
                },
              },
            },
          }),

          400: errorResponse("Invalid search parameters"),
          502: errorResponse("TMDB request or response error"),
          503: errorResponse("TMDB unavailable or not configured"),
          504: errorResponse("TMDB request timed out"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/api/movies/import": {
      post: {
        tags: ["TMDB"],
        summary: "Import a TMDB movie into the collection",

        description:
          "Fetches movie details from TMDB and saves them to MongoDB. " +
          "Duplicate TMDB IDs are rejected. " +
          "Poster processing is not connected yet.",

        requestBody: jsonBody("ImportMovie", {
          tmdbId: 157336,
          status: "want-to-watch",
          favorite: false,
        }),

        responses: {
          201: {
            ...jsonResponse("Movie imported", singleMovieResponse),

            headers: {
              Location: {
                description: "API URL of the imported movie.",
                schema: {
                  type: "string",
                },
              },
            },
          },

          400: errorResponse("Invalid request"),
          404: errorResponse("Movie not found on TMDB"),
          409: errorResponse("Movie already imported"),
          413: errorResponse("Request body too large"),
          415: errorResponse("Content-Type must be application/json"),
          422: errorResponse("Movie details cannot be imported"),
          502: errorResponse("TMDB request or response error"),
          503: errorResponse("Database or TMDB unavailable"),
          504: errorResponse("TMDB request timed out"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check API and database readiness",
        responses: {
          200: jsonResponse("Database connected", {
            type: "object",
            properties: {
              status: {
                type: "string",
                example: "ok",
              },
              database: {
                type: "string",
                example: "connected",
              },
            },
          }),

          503: jsonResponse("Database disconnected", {
            type: "object",
            properties: {
              status: {
                type: "string",
                example: "unavailable",
              },
              database: {
                type: "string",
                example: "disconnected",
              },
            },
          }),
        },
      },
    },

    "/api/movies": {
      get: {
        tags: ["Movies"],
        summary: "List, search, and filter movies",
        description:
          "Results are ordered newest first. Filters can be combined.",

        parameters: [
          {
            name: "search",
            in: "query",
            description: "Case-insensitive title search using literal text.",
            schema: {
              type: "string",
              maxLength: 120,
            },
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["want-to-watch", "watching", "watched"],
            },
          },
          {
            name: "favorite",
            in: "query",
            description: "Omit to include both favorites and non-favorites.",
            schema: {
              type: "boolean",
            },
          },
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100000,
              default: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],

        responses: {
          200: jsonResponse("Movie collection", {
            type: "object",
            properties: {
              movies: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/Movie",
                },
              },
              pagination: {
                $ref: "#/components/schemas/Pagination",
              },
            },
          }),

          400: errorResponse("Invalid query parameters"),
          503: errorResponse("Database unavailable"),
          500: errorResponse("Internal server error"),
        },
      },

      post: {
        tags: ["Movies"],
        summary: "Create a movie manually",

        requestBody: jsonBody("CreateMovie", createExample),

        responses: {
          201: {
            ...jsonResponse("Movie created", singleMovieResponse),

            headers: {
              Location: {
                description: "API URL of the created movie.",
                schema: {
                  type: "string",
                },
              },
            },
          },

          400: errorResponse("Invalid input or malformed JSON"),
          413: errorResponse("Request body too large"),
          415: errorResponse("Content-Type must be application/json"),
          503: errorResponse("Database unavailable"),
          500: errorResponse("Internal server error"),
        },
      },
    },

    "/api/movies/{id}": {
      // Shared by GET, PATCH, and DELETE below.
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Use an actual movie ID returned by the API.",
          schema: {
            type: "string",
            pattern: "^[a-fA-F0-9]{24}$",
          },
        },
      ],

      get: {
        tags: ["Movies"],
        summary: "Get one movie",

        responses: {
          200: jsonResponse("Movie details", singleMovieResponse),
          400: errorResponse("Invalid movie ID"),
          404: errorResponse("Movie not found"),
          503: errorResponse("Database unavailable"),
          500: errorResponse("Internal server error"),
        },
      },

      patch: {
        tags: ["Movies"],
        summary: "Update a movie",
        description:
          "Send at least one editable field. Omitted fields remain unchanged.",

        requestBody: jsonBody("UpdateMovie", {
          status: "watched",
          favorite: true,
        }),

        responses: {
          200: jsonResponse("Movie updated", singleMovieResponse),
          400: errorResponse("Invalid ID, input, or JSON"),
          404: errorResponse("Movie not found"),
          413: errorResponse("Request body too large"),
          415: errorResponse("Content-Type must be application/json"),
          503: errorResponse("Database unavailable"),
          500: errorResponse("Internal server error"),
        },
      },

      delete: {
        tags: ["Movies"],
        summary: "Delete a movie",

        responses: {
          204: {
            description: "Movie deleted. No response body.",
          },

          400: errorResponse("Invalid movie ID"),
          404: errorResponse("Movie not found"),
          503: errorResponse("Database unavailable"),
          500: errorResponse("Internal server error"),
        },
      },
    },
  },

  components: {
    schemas: {
      CreateMovie: {
        type: "object",
        additionalProperties: false,
        required: ["title", "releaseDate", "status", "favorite"],
        description:
          "Rating defaults to null and genres defaults to an empty array.",
        properties: movieFields,
      },

      UpdateMovie: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: movieFields,
      },

      Movie: {
        type: "object",
        properties: {
          id: {
            type: "string",
            readOnly: true,
          },

          ...movieFields,

          posterUrl: {
            type: "string",
            nullable: true,
            readOnly: true,
          },

          posterStatus: {
            type: "string",
            enum: ["none", "pending", "processing", "ready", "failed"],
            readOnly: true,
          },

          source: {
            type: "string",
            enum: ["manual", "tmdb"],
            readOnly: true,
          },

          tmdbId: {
            type: "integer",
            nullable: true,
            readOnly: true,
          },

          createdAt: {
            type: "string",
            format: "date-time",
            readOnly: true,
          },

          updatedAt: {
            type: "string",
            format: "date-time",
            readOnly: true,
          },
        },
      },

      Pagination: {
        type: "object",
        properties: {
          page: {
            type: "integer",
            example: 1,
          },
          limit: {
            type: "integer",
            example: 20,
          },
          total: {
            type: "integer",
            example: 1,
          },
          pages: {
            type: "integer",
            example: 1,
          },
        },
      },

      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Validation failed",
              },
              details: {
                type: "array",
                description: "Included for request-validation errors.",
                items: {
                  type: "object",
                  properties: {
                    field: {
                      type: "string",
                      example: "rating",
                    },
                    message: {
                      type: "string",
                      example: "Number must be less than or equal to 10",
                    },
                  },
                },
              },
            },
          },
        },
      },
      ImportMovie: {
        type: "object",
        additionalProperties: false,
        required: ["tmdbId"],

        properties: {
          tmdbId: {
            type: "integer",
            minimum: 1,
            maximum: 2147483647,
            example: 157336,
          },

          status: {
            type: "string",
            enum: ["want-to-watch", "watching", "watched"],
            default: "want-to-watch",
          },

          favorite: {
            type: "boolean",
            default: false,
          },
        },
      },
    },
  },
};

const posterPathParameters = [
  {
    name: "id",
    in: "path",
    required: true,
    schema: {
      type: "string",
      pattern: "^[a-fA-F0-9]{24}$",
    },
  },
];

swaggerDocument.paths["/api/movies/{id}/poster"] = {
  parameters: posterPathParameters,
  post: {
    tags: ["Movies"],
    summary: "Upload or replace a movie poster",
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["poster"],
            properties: {
              poster: {
                type: "string",
                format: "binary",
                description: "JPEG, PNG or WebP; maximum 10 MB.",
              },
            },
          },
        },
      },
    },
    responses: {
      202: jsonResponse("Poster accepted for processing", singleMovieResponse),
      400: errorResponse("Invalid upload"),
      404: errorResponse("Movie not found"),
      413: errorResponse("Image exceeds 10 MB"),
      415: errorResponse("Multipart upload required"),
      422: errorResponse("Unsupported or invalid image"),
      500: errorResponse("Server error"),
      503: errorResponse("Database unavailable"),
    },
  },
  delete: {
    tags: ["Movies"],
    summary: "Remove a poster and cancel its pending processing request",
    responses: {
      200: jsonResponse("Poster removed", singleMovieResponse),
      400: errorResponse("Invalid movie ID"),
      404: errorResponse("Movie not found"),
      500: errorResponse("Server error"),
      503: errorResponse("Database unavailable"),
    },
  },
};

swaggerDocument.paths["/api/movies/{id}/poster/retry"] = {
  parameters: posterPathParameters,
  post: {
    tags: ["Movies"],
    summary: "Retry a failed poster request",
    responses: {
      202: jsonResponse("Retry requested", singleMovieResponse),
      400: errorResponse("Invalid movie ID"),
      404: errorResponse("Movie not found"),
      409: errorResponse("No failed poster request to retry"),
      500: errorResponse("Server error"),
      503: errorResponse("Database unavailable"),
    },
  },
};

export default swaggerDocument;

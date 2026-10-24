import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },

    releaseDate: {
      type: Date,
      required: true,
    },

    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },

    genres: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
          maxlength: 50,
        },
      ],
      default: [],
      validate: {
        validator: (genres) => genres.length <= 10,
        message: "A movie can have at most 10 genres",
      },
    },

    status: {
      type: String,
      enum: ["want-to-watch", "watching", "watched"],
      required: true,
    },

    favorite: {
      type: Boolean,
      required: true,
    },

    posterUrl: {
      type: String,
      default: null,
    },

    posterStatus: {
      type: String,
      enum: ["none", "pending", "processing", "ready", "failed"],
      default: "none",
    },

    source: {
      type: String,
      enum: ["manual", "tmdb"],
      default: "manual",
    },

    tmdbId: {
      type: Number,
      default: null,
    },
    posterKey: {
      type: String,
      default: null,
    },
    posterJobId: {
      type: String,
      default: null,
    },
    posterInputKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,

    strict: "throw",

    toJSON: {
      transform(document, result) {
        // Return a simple "id" field to API clients.
        result.id = result._id.toString();

        // Return a date without a time component.
        result.releaseDate = result.releaseDate.toISOString().slice(0, 10);

        delete result._id;
        delete result.__v;

        return result;
      },
    },
  },
);

// Support sorting the collection by newest first.
movieSchema.index({ createdAt: -1, _id: -1 });

movieSchema.index(
  { tmdbId: 1 },
  {
    unique: true,

    partialFilterExpression: {
      tmdbId: { $type: "number" },
    },
  },
);

movieSchema.index({ posterStatus: 1, updatedAt: 1 });

const Movie = mongoose.model("Movie", movieSchema);

export default Movie;

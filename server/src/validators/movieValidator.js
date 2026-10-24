import { z } from "zod";

const statusSchema = z.enum(["want-to-watch", "watching", "watched"]);

// Accept only real dates written as YYYY-MM-DD.
const releaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return date.toISOString().slice(0, 10) === value;
  }, "Enter a real calendar date");

// Define every field the user is allowed to edit.
const editableMovieSchema = z
  .object({
    title: z.string().trim().min(1).max(120),

    releaseDate: releaseDateSchema,

    rating: z.number().finite().min(0).max(10).nullable(),

    genres: z
      .array(z.string().trim().min(1).max(50))
      .max(10)
      .transform((genres) => [...new Set(genres)]),

    status: statusSchema,

    favorite: z.boolean(),
  })
  .strict();

// Creation requires title, releaseDate, status, and favorite.
// Rating and genres receive defaults when omitted.
export const createMovieSchema = editableMovieSchema.extend({
  rating: editableMovieSchema.shape.rating.optional().default(null),

  genres: editableMovieSchema.shape.genres.optional().default([]),
});

// Editing accepts a nonempty subset of the editable fields.
export const updateMovieSchema = editableMovieSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// Query parameters arrive as strings.
// Validate them before converting them to numbers.
function positiveIntegerQuery(maximum) {
  return z
    .string()
    .regex(/^[1-9]\d*$/, "Enter a positive integer")
    .transform(Number)
    .refine(
      (value) => Number.isSafeInteger(value) && value <= maximum,
      `Maximum allowed value is ${maximum}`,
    );
}

export const listMoviesSchema = z
  .object({
    search: z.string().trim().max(120).optional(),

    status: statusSchema.optional(),

    favorite: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    page: positiveIntegerQuery(100000).optional().default("1"),

    limit: positiveIntegerQuery(100).optional().default("20"),
  })
  .strict();

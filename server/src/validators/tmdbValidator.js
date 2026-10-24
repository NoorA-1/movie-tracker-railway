import { z } from "zod";

export const tmdbSearchSchema = z
  .object({
    query: z.string().trim().min(1, "Enter a movie title").max(120),

    page: z
      .string()
      .regex(/^[1-9]\d*$/, "Page must be a positive integer")
      .transform(Number)
      .refine(
        (value) => Number.isSafeInteger(value) && value <= 500,
        "Page must be between 1 and 500",
      )
      .optional()
      .default("1"),
  })
  .strict();

export const importMovieSchema = z
  .object({
    tmdbId: z.number().int().positive().max(2147483647),

    status: z
      .enum(["want-to-watch", "watching", "watched"])
      .optional()
      .default("want-to-watch"),

    favorite: z.boolean().optional().default(false),
  })
  .strict();

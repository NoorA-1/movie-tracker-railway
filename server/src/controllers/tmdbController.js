import { tmdbSearchSchema } from "../validators/tmdbValidator.js";
import { searchTmdbMovies } from "../services/tmdbService.js";

export async function searchMovies(req, res) {
  const { query, page } = tmdbSearchSchema.parse(req.query);

  const results = await searchTmdbMovies(query, page);

  res.json(results);
}

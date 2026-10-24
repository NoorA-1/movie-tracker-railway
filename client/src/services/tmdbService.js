export async function searchTmdbMovies({ query, page = 1, signal }) {
  const parameters = new URLSearchParams({
    query,
    page: String(page),
  });

  const response = await fetch(`/api/tmdb/search?${parameters}`, { signal });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const details = data?.error?.details;

    const message = details?.length
      ? details.map((detail) => `${detail.field}: ${detail.message}`).join("\n")
      : data?.error?.message || "Could not search TMDB.";

    throw new Error(message);
  }

  if (!data || !Array.isArray(data.results)) {
    throw new Error("The server returned an unexpected response.");
  }

  return data;
}

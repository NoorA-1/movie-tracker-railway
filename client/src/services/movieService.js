const API_URL = "/api/movies";

async function request(path = "", { body, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,

    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },

    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Successful DELETE requests have no response body.
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const details = data?.error?.details;

    const message = details?.length
      ? details.map((detail) => `${detail.field}: ${detail.message}`).join("\n")
      : data?.error?.message ||
        "Request failed. Check that the backend is running.";

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!data) {
    throw new Error("The server returned an unexpected response.");
  }

  return data;
}

export async function getMovies({
  page = 1,
  search = "",
  favorite = false,
  signal,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: "12",
  });

  if (search.trim()) {
    query.set("search", search.trim());
  }

  if (favorite) {
    query.set("favorite", "true");
  }

  const data = await request(`?${query}`, { signal });

  if (!Array.isArray(data.movies) || !data.pagination) {
    throw new Error("The server returned an unexpected response.");
  }

  return data;
}

export async function createMovie(movieData) {
  const data = await request("", {
    method: "POST",
    body: movieData,
  });

  return data.movie;
}

export async function updateMovie(id, movieData) {
  const data = await request(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: movieData,
  });

  return data.movie;
}

export async function deleteMovie(id) {
  await request(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function importMovie(tmdbId) {
  const data = await request("/import", {
    method: "POST",
    body: { tmdbId },
  });

  return data.movie;
}

async function posterRequest(movieId, suffix = "", options = {}) {
  const response = await fetch(
    `/api/movies/${encodeURIComponent(movieId)}/poster${suffix}`,
    options,
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "The poster request failed.");
  }

  if (!data?.movie) {
    throw new Error("The server returned an unexpected response.");
  }

  return data.movie;
}

export function uploadMoviePoster(movieId, file) {
  const body = new FormData();
  body.append("poster", file);

  return posterRequest(movieId, "", {
    method: "POST",
    body,
  });
}

export function removeMoviePoster(movieId) {
  return posterRequest(movieId, "", {
    method: "DELETE",
  });
}

export function retryMoviePoster(movieId) {
  return posterRequest(movieId, "/retry", {
    method: "POST",
  });
}

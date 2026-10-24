import { useState } from "react";

const statusLabels = {
  pending: "Poster queued…",
  processing: "Processing poster…",
  failed: "Poster processing failed",
  none: "No poster",
};

export default function MoviePoster({ movie }) {
  const [failedUrl, setFailedUrl] = useState(null);

  const canDisplayImage =
    Boolean(movie.posterUrl) && failedUrl !== movie.posterUrl;

  if (canDisplayImage) {
    return (
      <img
        className="movie-poster"
        src={movie.posterUrl}
        alt={`${movie.title} poster`}
        loading="lazy"
        onError={() => setFailedUrl(movie.posterUrl)}
      />
    );
  }

  const label = movie.posterUrl
    ? "Poster unavailable"
    : statusLabels[movie.posterStatus] || "No poster";

  return (
    <div className="movie-poster-fallback">
      <span className="movie-poster-letter" aria-hidden="true">
        {movie.title.slice(0, 1).toUpperCase()}
      </span>

      <span className="movie-poster-status">{label}</span>
    </div>
  );
}

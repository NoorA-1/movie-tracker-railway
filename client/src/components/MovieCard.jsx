import MoviePoster from "./MoviePoster";
import PosterControls from "./PosterControls";

const statusLabels = {
  "want-to-watch": "Want to Watch",
  watching: "Watching",
  watched: "Watched",
};

export default function MovieCard({
  movie,
  onEdit,
  onDelete,
  disabled = false,
  onPosterChanged,
  onPosterBusyChange,
}) {
  return (
    <article className="movie-card">
      <MoviePoster movie={movie} />

      <div className="movie-card-content">
        <div className="movie-card-top">
          <span className="status-badge">{statusLabels[movie.status]}</span>

          {movie.favorite && (
            <span className="favorite-icon" aria-label="Favorite">
              ♥
            </span>
          )}
        </div>

        <h2>{movie.title}</h2>

        <p className="movie-meta">
          {movie.releaseDate.slice(0, 4)}
          {" · "}
          {movie.rating === null
            ? "Unrated"
            : `${movie.rating.toFixed(1)} / 10`}
        </p>

        <p className="movie-genres">
          {movie.genres.length > 0
            ? movie.genres.join(" · ")
            : "No genres added"}
        </p>

        <div className="card-actions">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(movie)}
            aria-label={`Edit ${movie.title}`}
          >
            Edit
          </button>

          <button
            type="button"
            className="danger-button"
            disabled={disabled}
            onClick={() => onDelete(movie)}
            aria-label={`Delete ${movie.title}`}
          >
            Delete
          </button>
        </div>
        <PosterControls
          movie={movie}
          disabled={disabled}
          onChanged={onPosterChanged}
          onBusyChange={onPosterBusyChange}
        />
      </div>
    </article>
  );
}

import { useState } from "react";
import { createMovie, updateMovie } from "../services/movieService";

const initialForm = {
  title: "",
  releaseDate: "",
  rating: "",
  genres: "",
  status: "want-to-watch",
  favorite: false,
};

export default function MovieForm({
  movie = null,
  onSaved,
  onCancel,
  onSavingChange,
}) {
  const isEditing = movie !== null;

  const [form, setForm] = useState(() => {
    if (!movie) {
      return { ...initialForm };
    }

    return {
      title: movie.title,
      releaseDate: movie.releaseDate,
      rating: movie.rating ?? "",
      genres: movie.genres.join(", "),
      status: movie.status,
      favorite: movie.favorite,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    const title = form.title.trim();

    if (!title) {
      setError("Please enter a movie title.");
      return;
    }

    const movieData = {
      title,
      releaseDate: form.releaseDate,

      rating: form.rating === "" ? null : Number(form.rating),

      genres: form.genres
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),

      status: form.status,
      favorite: form.favorite,
    };

    setSaving(true);
    onSavingChange(true);

    try {
      const savedMovie = isEditing
        ? await updateMovie(movie.id, movieData)
        : await createMovie(movieData);

      onSaved(savedMovie);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <section className="movie-form-panel" aria-labelledby="add-movie-heading">
      <h2 id="add-movie-heading">{isEditing ? "Edit movie" : "Add a movie"}</h2>

      <p className="form-description">Fields marked * are required.</p>

      <form onSubmit={handleSubmit} aria-busy={saving}>
        <fieldset disabled={saving}>
          <div className="form-field">
            <label htmlFor="movie-title">Title *</label>

            <input
              id="movie-title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              maxLength={120}
              placeholder="Interstellar"
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="movie-release-date">Release date *</label>

              <input
                id="movie-release-date"
                name="releaseDate"
                type="date"
                value={form.releaseDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="movie-rating">Rating / 10</label>

              <input
                id="movie-rating"
                name="rating"
                type="number"
                value={form.rating}
                onChange={handleChange}
                min="0"
                max="10"
                step="any"
                placeholder="Unrated"
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="movie-genres">Genres</label>

            <input
              id="movie-genres"
              name="genres"
              type="text"
              value={form.genres}
              onChange={handleChange}
              placeholder="Adventure, Drama, Science Fiction"
              aria-describedby="genres-help"
            />

            <small id="genres-help">
              Separate genres with commas. Maximum 10 genres.
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="movie-status">Status *</label>

            <select
              id="movie-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              required
            >
              <option value="want-to-watch">Want to Watch</option>

              <option value="watching">Watching</option>

              <option value="watched">Watched</option>
            </select>
          </div>

          <label className="checkbox-label">
            <input
              name="favorite"
              type="checkbox"
              checked={form.favorite}
              onChange={handleChange}
            />
            Mark as favorite
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="submit">
              {saving ? "Saving…" : isEditing ? "Save changes" : "Save movie"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

import { useEffect, useState } from "react";

import MovieCard from "./components/MovieCard";
import MovieForm from "./components/MovieForm";
import TmdbSearch from "./components/TmdbSearch";

import { getMovies, deleteMovie } from "./services/movieService";

export default function App() {
  const [movies, setMovies] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  // Text currently being typed.
  const [searchInput, setSearchInput] = useState("");

  // Filters currently applied to the API request.
  const [filters, setFilters] = useState({
    search: "",
    favorite: false,
  });

  // null: form closed
  // { movie: null }: create a movie
  // { movie: existingMovie }: edit a movie
  const [editor, setEditor] = useState(null);

  // True while saving or deleting.
  const [busy, setBusy] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [showTmdbSearch, setShowTmdbSearch] = useState(false);

  const hasActiveFilters = filters.search !== "" || filters.favorite;

  const filtersDisabled = busy || editor !== null || showTmdbSearch;

  useEffect(() => {
    const controller = new AbortController();

    async function loadMovies() {
      setLoading(true);
      setError("");

      try {
        const data = await getMovies({
          page,
          search: filters.search,
          favorite: filters.favorite,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        // Move back if deleting a movie leaves this page empty.
        if (page > 1 && data.movies.length === 0) {
          setPage(page - 1);
          return;
        }

        setMovies(data.movies);
        setPagination(data.pagination);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadMovies();

    return () => controller.abort();
  }, [page, refreshCount, filters]);

  function refreshMovies() {
    setRefreshCount((current) => current + 1);
  }

  function handleSearch(event) {
    event.preventDefault();

    if (filtersDisabled) {
      return;
    }

    setPage(1);

    setFilters((current) => ({
      ...current,
      search: searchInput.trim(),
    }));
  }

  function toggleFavorites() {
    setPage(1);

    setFilters((current) => ({
      ...current,
      favorite: !current.favorite,
    }));
  }

  function clearFilters() {
    setSearchInput("");
    setPage(1);

    setFilters({
      search: "",
      favorite: false,
    });
  }

  function openAddForm() {
    setSuccessMessage("");
    setActionError("");
    setEditor({ movie: null });
  }

  function openEditForm(movie) {
    setSuccessMessage("");
    setActionError("");
    setEditor({ movie });
  }

  function handleMovieSaved(movie) {
    const wasEditing = Boolean(editor?.movie);

    setEditor(null);

    setSuccessMessage(
      wasEditing
        ? `"${movie.title}" was updated.`
        : `"${movie.title}" was added to your collection.`,
    );

    if (!wasEditing) {
      setPage(1);
    }

    refreshMovies();
  }

  async function handleDeleteMovie(movie) {
    if (busy || editor || showTmdbSearch) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${movie.title}" from your collection? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setActionError("");
    setSuccessMessage("");

    try {
      await deleteMovie(movie.id);

      setSuccessMessage(`"${movie.title}" was deleted.`);
      refreshMovies();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openTmdbSearch() {
    setSuccessMessage("");
    setActionError("");
    setShowTmdbSearch(true);
  }

  function handleMovieImported(movie) {
    setShowTmdbSearch(false);

    setSuccessMessage(`"${movie.title}" was imported into your collection.`);

    // Show the new movie even if collection filters were active.
    setSearchInput("");
    setFilters({
      search: "",
      favorite: false,
    });

    setPage(1);
    refreshMovies();
  }

  function handlePosterChanged(updatedMovie, message) {
    setMovies((current) =>
      current.map((movie) =>
        movie.id === updatedMovie.id ? updatedMovie : movie,
      ),
    );

    setSuccessMessage(message);
    setActionError("");
  }

  useEffect(() => {
    const hasUnfinishedPosters = movies.some(
      (movie) =>
        movie.posterStatus === "pending" || movie.posterStatus === "processing",
    );

    if (
      !hasUnfinishedPosters ||
      loading ||
      error ||
      busy ||
      editor !== null ||
      showTmdbSearch
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRefreshCount((current) => current + 1);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [movies, loading, error, busy, editor, showTmdbSearch]);

  return (
    <main className="app-container">
      <header className="page-header">
        <div>
          {/* <p className="eyebrow">YOUR COLLECTION</p> */}
          <h1>Movie Tracker</h1>

          {/* <p className="page-description">
            Keep track of the films you love and what to watch next.
          </p> */}
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={refreshMovies}
            disabled={loading || busy || showTmdbSearch}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          {!editor && !showTmdbSearch && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={openTmdbSearch}
                disabled={busy}
              >
                Search TMDB
              </button>

              <button type="button" onClick={openAddForm} disabled={busy}>
                + Add manually
              </button>
            </>
          )}
        </div>
      </header>

      {successMessage && (
        <p className="success-message" role="status">
          {successMessage}
        </p>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {editor && (
        <MovieForm
          key={editor.movie?.id ?? "new"}
          movie={editor.movie}
          onSaved={handleMovieSaved}
          onCancel={() => setEditor(null)}
          onSavingChange={setBusy}
        />
      )}

      {showTmdbSearch && (
        <TmdbSearch
          onImported={handleMovieImported}
          onClose={() => setShowTmdbSearch(false)}
          onBusyChange={setBusy}
        />
      )}

      <form className="filter-bar" onSubmit={handleSearch}>
        <input
          className="search-field"
          type="search"
          aria-label="Search movie titles"
          placeholder="Search by movie title…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          maxLength={120}
          disabled={filtersDisabled}
        />

        <button type="submit" disabled={filtersDisabled}>
          Search
        </button>

        <button
          type="button"
          className="favorite-filter"
          aria-pressed={filters.favorite}
          onClick={toggleFavorites}
          disabled={filtersDisabled}
        >
          <span aria-hidden="true">{filters.favorite ? "♥" : "♡"}</span>{" "}
          Favorites
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={clearFilters}
          disabled={
            filtersDisabled || (!hasActiveFilters && searchInput === "")
          }
        >
          Clear
        </button>
      </form>

      <section aria-labelledby="collection-title">
        <div className="section-heading">
          <h2 id="collection-title">Your movies</h2>

          {!loading && !error && (
            <span>
              {pagination.total} {pagination.total === 1 ? "movie" : "movies"}
            </span>
          )}
        </div>

        {loading && (
          <div className="message-panel" role="status">
            Loading your collection…
          </div>
        )}

        {!loading && error && (
          <div className="message-panel error-panel" role="alert">
            <p>{error}</p>

            <button type="button" onClick={refreshMovies} disabled={busy}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && movies.length === 0 && (
          <div className="message-panel">
            <h3>
              {hasActiveFilters
                ? "No matching movies"
                : "Your collection is empty"}
            </h3>

            <p>
              {hasActiveFilters
                ? "Try another title or clear your filters."
                : "Your saved movies will appear here."}
            </p>
          </div>
        )}

        {!loading && !error && movies.length > 0 && (
          <>
            <div className="movie-grid">
              {movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onEdit={openEditForm}
                  onDelete={handleDeleteMovie}
                  disabled={filtersDisabled}
                  onPosterChanged={handlePosterChanged}
                  onPosterBusyChange={setBusy}
                />
              ))}
            </div>

            {pagination.pages > 1 && (
              <nav className="pagination" aria-label="Movie pages">
                <button
                  type="button"
                  disabled={page === 1 || filtersDisabled}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {pagination.pages}
                </span>

                <button
                  type="button"
                  disabled={page >= pagination.pages || filtersDisabled}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}

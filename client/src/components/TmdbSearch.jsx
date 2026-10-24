import { useEffect, useState } from "react";

import { searchTmdbMovies } from "../services/tmdbService";
import { importMovie } from "../services/movieService";

function PosterPreview({ url, title }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <div className="tmdb-poster-placeholder">No poster</div>;
  }

  return (
    <img
      className="tmdb-poster"
      src={url}
      alt={`${title} poster`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function TmdbSearch({ onImported, onClose, onBusyChange }) {
  const [input, setInput] = useState("");

  // The submitted search and requested page.
  const [searchRequest, setSearchRequest] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [importingId, setImportingId] = useState(null);
  const [importError, setImportError] = useState("");

  // Remember duplicate imports encountered while this panel is open.
  const [existingIds, setExistingIds] = useState([]);

  const importing = importingId !== null;

  useEffect(() => {
    if (!searchRequest) {
      return;
    }

    const controller = new AbortController();

    async function loadResults() {
      try {
        const results = await searchTmdbMovies({
          ...searchRequest,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setData(results);
        }
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

    loadResults();

    return () => controller.abort();
  }, [searchRequest]);

  function beginSearch(query, page = 1) {
    setLoading(true);
    setData(null);
    setError("");
    setImportError("");
    setSearchRequest({ query, page });
  }

  function handleSearch(event) {
    event.preventDefault();

    if (loading || importing) {
      return;
    }

    const query = input.trim();

    if (!query) {
      setError("Enter a movie title.");
      return;
    }

    beginSearch(query);
  }

  async function handleImport(result) {
    if (importing) {
      return;
    }

    setImportingId(result.tmdbId);
    setImportError("");
    onBusyChange(true);

    try {
      const movie = await importMovie(result.tmdbId);

      onImported(movie);
    } catch (err) {
      if (err.status === 409) {
        setExistingIds((current) => [...new Set([...current, result.tmdbId])]);
      }

      setImportError(err.message);
    } finally {
      setImportingId(null);
      onBusyChange(false);
    }
  }

  return (
    <section className="tmdb-panel" aria-labelledby="tmdb-heading">
      <div className="tmdb-panel-heading">
        <div>
          <h2 id="tmdb-heading">Search TMDB</h2>

          <p>Find a movie and import it into your collection.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          disabled={importing}
        >
          Close
        </button>
      </div>

      <form className="tmdb-search-form" onSubmit={handleSearch}>
        <input
          className="search-field"
          type="search"
          aria-label="Search TMDB by movie title"
          placeholder="Search for a movie…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={120}
          disabled={loading || importing}
          required
          autoFocus
        />

        <button type="submit" disabled={loading || importing}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="form-error" role="alert">
          <p>{error}</p>

          {searchRequest && !loading && (
            <button
              type="button"
              onClick={() =>
                beginSearch(searchRequest.query, searchRequest.page)
              }
              disabled={importing}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {importError && (
        <p className="form-error" role="alert">
          {importError}
        </p>
      )}

      {loading && <p role="status">Searching TMDB…</p>}

      {!loading && data && (
        <>
          <p className="tmdb-result-count">
            {data.totalResults} results for “{searchRequest.query}”
          </p>

          {data.results.length === 0 ? (
            <div className="message-panel">
              No movies found. Try another title.
            </div>
          ) : (
            <div className="tmdb-results">
              {data.results.map((result) => {
                const alreadyImported = existingIds.includes(result.tmdbId);

                const hasReleaseDate = Boolean(result.releaseDate);

                return (
                  <article className="tmdb-result" key={result.tmdbId}>
                    <PosterPreview
                      key={result.posterPreviewUrl || "no-poster"}
                      url={result.posterPreviewUrl}
                      title={result.title}
                    />

                    <div className="tmdb-result-info">
                      <h3>{result.title}</h3>

                      <p>
                        {hasReleaseDate
                          ? result.releaseDate.slice(0, 4)
                          : "Release date unknown"}

                        {" · "}

                        {result.rating === null
                          ? "Unrated"
                          : `${result.rating.toFixed(1)} / 10`}
                      </p>

                      {!hasReleaseDate && (
                        <p className="tmdb-note">
                          A release date is required. Add this movie manually
                          with a known date.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleImport(result)}
                        disabled={
                          importing || alreadyImported || !hasReleaseDate
                        }
                      >
                        {importingId === result.tmdbId
                          ? "Importing…"
                          : alreadyImported
                            ? "Already in collection"
                            : "Import"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {data.totalPages > 1 && (
            <nav className="pagination" aria-label="TMDB result pages">
              <button
                type="button"
                disabled={data.page <= 1 || importing}
                onClick={() => beginSearch(searchRequest.query, data.page - 1)}
              >
                Previous
              </button>

              <span>
                Page {data.page} of {data.totalPages}
              </span>

              <button
                type="button"
                disabled={data.page >= data.totalPages || importing}
                onClick={() => beginSearch(searchRequest.query, data.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

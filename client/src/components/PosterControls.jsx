import { useState } from "react";

import {
  uploadMoviePoster,
  removeMoviePoster,
  retryMoviePoster,
} from "../services/posterService";

export default function PosterControls({
  movie,
  disabled = false,
  onChanged,
  onBusyChange,
}) {
  const [file, setFile] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const pending =
    movie.posterStatus === "pending" || movie.posterStatus === "processing";

  const canRemove =
    Boolean(movie.posterUrl) ||
    Boolean(movie.posterInputKey) ||
    pending ||
    movie.posterStatus === "failed";

  async function run(action, message) {
    if (working || disabled) {
      return;
    }

    setWorking(true);
    setError("");
    onBusyChange(true);

    try {
      const updated = await action();

      setFile(null);
      setInputKey((current) => current + 1);

      onChanged(updated, message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
      onBusyChange(false);
    }
  }

  function handleUpload(event) {
    event.preventDefault();

    if (!file) {
      setError("Choose an image first.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Choose an image that is 10 MB or smaller.");
      return;
    }

    void run(
      () => uploadMoviePoster(movie.id, file),
      "Poster uploaded. Background processing will start shortly.",
    );
  }

  function handleRemove() {
    if (!window.confirm(`Remove the poster for "${movie.title}"?`)) {
      return;
    }

    void run(() => removeMoviePoster(movie.id), "Poster removed.");
  }

  return (
    <details className="poster-controls">
      <summary>Poster options</summary>

      {pending && (
        <p className="poster-help" role="status">
          {movie.posterStatus === "pending"
            ? "Poster queued for processing."
            : "Processing poster…"}
        </p>
      )}

      {movie.posterStatus === "failed" && (
        <p className="poster-help" role="status">
          Poster processing failed. Retry it or upload another image.
        </p>
      )}

      <form onSubmit={handleUpload}>
        <fieldset disabled={disabled || working}>
          <label htmlFor={`poster-file-${movie.id}`}>Choose a poster</label>

          <input
            key={inputKey}
            id={`poster-file-${movie.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
            }}
          />

          <p className="poster-help">JPEG, PNG or WebP. Maximum 10 MB.</p>

          <div className="poster-buttons">
            <button type="submit" disabled={!file}>
              {working
                ? "Please wait…"
                : movie.posterUrl
                  ? "Replace poster"
                  : "Upload poster"}
            </button>

            {movie.posterStatus === "failed" && (
              <button
                type="button"
                onClick={() => {
                  void run(
                    () => retryMoviePoster(movie.id),
                    "Poster retry requested.",
                  );
                }}
              >
                Retry
              </button>
            )}

            {canRemove && (
              <button
                type="button"
                className="danger-button"
                onClick={handleRemove}
              >
                Remove poster
              </button>
            )}
          </div>
        </fieldset>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}

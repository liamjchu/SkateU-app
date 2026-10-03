"use client";

import { useEffect, useState } from "react";

import { isSchoolId, MIN_SCHOOL_SEARCH_LENGTH, type CampusSchool } from "../../lib/campus";

type SearchStatus = "idle" | "loading" | "ready" | "error";

const DEBOUNCE_MS = 250;

export function SchoolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CampusSchool[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryNonce, setRetryNonce] = useState(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_SCHOOL_SEARCH_LENGTH) {
      setResults((current) => (current.length === 0 ? current : []));
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");

      fetch(`/api/schools/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("School search failed.");
          }

          return (await response.json()) as { schools?: unknown };
        })
        .then((body) => {
          if (controller.signal.aborted) {
            return;
          }

          setResults(readSchools(body.schools));
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }

          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, retryNonce]);

  const visibleResults = trimmed.length < MIN_SCHOOL_SEARCH_LENGTH ? [] : results;
  const visibleStatus = trimmed.length < MIN_SCHOOL_SEARCH_LENGTH ? "idle" : status;

  return (
    <div className="w-full text-left">
      <label className="sr-only" htmlFor="school-search">
        Search all schools
      </label>
      <input
        id="school-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setStatus("idle");
        }}
        placeholder="Search all schools..."
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        enterKeyHint="search"
        className="min-h-11 w-full rounded-2xl border border-border-soft bg-field px-4 text-base font-medium text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
      />

      {trimmed.length > 0 && trimmed.length < MIN_SCHOOL_SEARCH_LENGTH ? (
        <p className="mt-3 text-sm font-medium text-muted">Type at least 2 characters.</p>
      ) : null}

      {visibleStatus === "loading" ? (
        <p className="mt-3 text-sm font-medium text-muted" role="status">
          Searching...
        </p>
      ) : null}

      {visibleStatus === "error" ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-errorBorder bg-errorSurface px-4 py-3" role="alert">
          <p className="text-sm font-medium text-errorText">School search is unavailable.</p>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-white"
            onClick={() => setRetryNonce((nonce) => nonce + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {visibleStatus === "ready" && visibleResults.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-muted" role="status">
          No schools found.
        </p>
      ) : null}

      {visibleResults.length > 0 ? (
        <ul aria-label="Schools" className="mt-3 overflow-hidden rounded-2xl border border-border-soft bg-field">
          {visibleResults.map((school) => (
            <li key={school.id} className="border-b border-border-soft last:border-b-0">
              <a
                href={`/school/${school.id}`}
                className="flex min-h-11 flex-col justify-center px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <span className="break-words font-bold text-ink">{school.name}</span>
                <span className="text-sm font-medium text-muted">
                  {school.city}, {school.state}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function readSchools(value: unknown): CampusSchool[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isSearchSchool(item)) {
      return [];
    }

    return [
      {
        id: item.id,
        name: item.name,
        city: item.city,
        state: item.state,
        lat: 0,
        lng: 0,
        numSpots: 0,
      },
    ];
  });
}

function isSearchSchool(
  value: unknown
): value is { id: string; name: string; city: string; state: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const school = value as Record<string, unknown>;

  return (
    typeof school.id === "string" &&
    isSchoolId(school.id) &&
    typeof school.name === "string" &&
    school.name.trim().length > 0 &&
    typeof school.city === "string" &&
    typeof school.state === "string"
  );
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

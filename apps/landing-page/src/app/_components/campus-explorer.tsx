"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatPlace,
  readClientSpots,
  spotCountLabel,
  type CampusSchool,
  type CampusSpot,
} from "../../lib/campus";

const CampusMap = dynamic(() => import("./campus-map").then((module) => module.CampusMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-surface-soft text-sm font-medium text-muted">
      Loading map…
    </div>
  ),
});

type CampusExplorerProps = {
  school: CampusSchool;
  spots: CampusSpot[];
  initialSpotId: string | null;
  startWithAllSpots?: boolean;
};

export function CampusExplorer({
  school,
  spots,
  initialSpotId,
  startWithAllSpots = false,
}: CampusExplorerProps) {
  const [selectedSpotId, setSelectedSpotId] = useState(initialSpotId);
  const [showAll, setShowAll] = useState(false);
  const [allSpots, setAllSpots] = useState<CampusSpot[] | null>(null);
  const [allSpotsError, setAllSpotsError] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const allSpotsRequest = useRef<Promise<CampusSpot[]> | null>(null);
  const visibleSpots = showAll && allSpots ? allSpots : spots;
  const selectedSpot = visibleSpots.find((spot) => spot.id === selectedSpotId) ?? null;
  const selectSpot = useCallback((spotId: string) => {
    setSelectedSpotId(spotId);
    writeSpotParam(spotId);
  }, []);

  const loadAllSpots = useCallback(async () => {
    setLoadingAll(true);
    setAllSpotsError(false);

    try {
      if (!allSpotsRequest.current) {
        allSpotsRequest.current = requestAllSpots().catch((error: unknown) => {
          allSpotsRequest.current = null;
          throw error;
        });
      }

      const parsed = await allSpotsRequest.current;
      setAllSpots(parsed);
      setShowAll(true);
    } catch {
      setAllSpotsError(true);
      setShowAll(false);
    } finally {
      setLoadingAll(false);
    }
  }, []);

  useEffect(() => {
    if (startWithAllSpots) {
      void loadAllSpots();
    }
  }, [loadAllSpots, startWithAllSpots]);

  function toggleAllSpots() {
    if (loadingAll) {
      return;
    }

    if (showAll) {
      const selectedLeavesSchool =
        selectedSpotId !== null && !spots.some((spot) => spot.id === selectedSpotId);
      setShowAll(false);

      if (selectedLeavesSchool) {
        setSelectedSpotId(null);
        writeSpotParam(null);
      }

      return;
    }

    if (allSpots) {
      setShowAll(true);
      return;
    }

    void loadAllSpots();
  }

  return (
    <div className="absolute inset-0 md:grid md:h-full md:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <div className="absolute inset-0 md:static md:col-start-2 md:h-full md:min-h-0">
        <CampusMap
          schoolName={school.name}
          latitude={school.lat}
          longitude={school.lng}
          spots={visibleSpots}
          selectedSpotId={selectedSpot?.id ?? null}
          onSelectSpot={selectSpot}
        />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-4">
          <button
            type="button"
            aria-pressed={showAll}
            disabled={loadingAll}
            className="pointer-events-auto min-h-11 rounded-full bg-field px-4 text-sm font-bold text-ink shadow-[0_8px_24px_rgba(42,34,36,0.16)] disabled:opacity-70"
            onClick={toggleAllSpots}
          >
            {loadingAll ? "Loading spots…" : showAll ? "This school" : "All spots"}
          </button>
          {allSpotsError ? (
            <div
              role="alert"
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-field px-4 py-2 shadow-[0_8px_24px_rgba(42,34,36,0.16)]"
            >
              <p className="text-sm font-medium text-ink">All spots didn’t load.</p>
              <button type="button" className="min-h-11 text-sm font-bold text-brand" onClick={() => void loadAllSpots()}>
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <section
        aria-label={school.name}
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[min(24rem,52svh)] flex-col rounded-t-2xl bg-field shadow-[0_-8px_24px_rgba(42,34,36,0.12)] md:static md:z-auto md:col-start-1 md:row-start-1 md:h-full md:max-h-none md:min-h-0 md:overflow-hidden md:rounded-none md:shadow-none"
      >
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-accent md:hidden" />
        <div className="shrink-0 px-5 pb-3 pt-3 md:pt-5">
          <h1 className="break-words text-xl font-bold text-ink">{school.name}</h1>
          <p className="mt-1 text-sm font-medium text-muted-strong">
            {formatPlace(school.city, school.state)}
          </p>
          <p className="mt-1 text-sm font-bold text-ink">{spotCountLabel(visibleSpots.length)}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {selectedSpot ? (
            <SpotCard
              spot={selectedSpot}
              showSchoolName={showAll}
              onBack={() => {
                setSelectedSpotId(null);
                writeSpotParam(null);
              }}
            />
          ) : null}

          <div className={selectedSpot ? "max-md:hidden" : undefined}>
            {visibleSpots.length === 0 ? (
              <p className="py-2 text-sm font-medium text-muted">
                {showAll ? "No spots yet." : "No spots at this school yet."}
              </p>
            ) : (
              <ul aria-label="Spots" className={selectedSpot ? "mt-4 border-t border-border-soft pt-2" : undefined}>
                {visibleSpots.map((spot) => {
                  const selected = spot.id === selectedSpot?.id;

                  return (
                    <li key={spot.id}>
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        className={`flex min-h-11 w-full items-center rounded-xl px-2 text-left font-bold text-ink ${selected ? "bg-surface-soft" : ""}`}
                        onClick={() => selectSpot(spot.id)}
                      >
                        <span className="flex min-w-0 flex-col py-2">
                          <span className="break-words">{spot.name}</span>
                          {showAll && spot.schoolName ? (
                            <span className="text-sm font-medium text-muted">{spot.schoolName}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <nav
          aria-label="Legal"
          className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 border-t border-border-soft px-5 py-3 text-xs font-bold md:hidden"
        >
          <a href="/privacy" className="text-muted underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          <a href="/terms" className="text-muted underline-offset-2 hover:underline">
            Terms of Use
          </a>
          <a href="/support" className="text-muted underline-offset-2 hover:underline">
            Support
          </a>
          <a href="/delete-account" className="text-muted underline-offset-2 hover:underline">
            Delete account
          </a>
        </nav>
      </section>
    </div>
  );
}

function SpotCard({
  spot,
  showSchoolName,
  onBack,
}: {
  spot: CampusSpot;
  showSchoolName: boolean;
  onBack: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const description = spot.description.trim();
  const showPhoto = spot.imageUrl !== null && !photoFailed;

  return (
    <article aria-label={spot.name}>
      <button
        type="button"
        className="mb-3 min-h-11 text-sm font-bold text-brand"
        onClick={onBack}
      >
        Spot list
      </button>
      {showPhoto ? (
        <img
          src={spot.imageUrl ?? undefined}
          alt={spot.name}
          className="mb-3 h-40 w-full rounded-xl object-cover"
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <p className="mb-3 rounded-xl bg-surface-soft px-4 py-8 text-center text-sm font-medium text-muted">
          No photo yet
        </p>
      )}
      <h2 className="break-words text-lg font-bold text-ink">{spot.name}</h2>
      {showSchoolName && spot.schoolName ? (
        <p className="mt-1 text-sm font-medium text-muted">{spot.schoolName}</p>
      ) : null}
      {description ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-strong">
          {description}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-bold text-ink">{likeLabel(spot.likeCount)}</p>
      {spot.creatorUsername ? (
        <p className="mt-1 text-sm font-medium text-muted">Added by @{spot.creatorUsername}</p>
      ) : null}
    </article>
  );
}

async function requestAllSpots(): Promise<CampusSpot[]> {
  const response = await fetch("/api/spots");

  if (!response.ok) {
    throw new Error("All spots are unavailable.");
  }

  const body: unknown = await response.json();

  if (typeof body !== "object" || body === null || !("spots" in body) || !Array.isArray(body.spots)) {
    throw new Error("All spots could not be read.");
  }

  return readClientSpots(body.spots);
}

function likeLabel(count: number): string {
  return count === 1 ? "1 like" : `${count} likes`;
}

function writeSpotParam(spotId: string | null) {
  const url = new URL(window.location.href);

  if (spotId) {
    url.searchParams.set("spot", spotId);
  } else {
    url.searchParams.delete("spot");
  }

  const search = url.searchParams.toString();
  window.history.replaceState(null, "", search ? `${url.pathname}?${search}` : url.pathname);
}

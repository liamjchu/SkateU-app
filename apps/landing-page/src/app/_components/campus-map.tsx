"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { CAMPUS_MAP_STYLE_URL, CAMPUS_MAP_ZOOM, type CampusSpot } from "../../lib/campus";

type CampusMapProps = {
  schoolName: string;
  latitude: number;
  longitude: number;
  spots: CampusSpot[];
  selectedSpotId: string | null;
  onSelectSpot: (spotId: string) => void;
};

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z" fill="#E67A90" stroke="#2A2224" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5" fill="#ffffff"/></svg>`;

export function CampusMap({
  schoolName,
  latitude,
  longitude,
  spots,
  selectedSpotId,
  onSelectSpot,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const spotsRef = useRef(spots);
  const onSelectRef = useRef(onSelectSpot);
  const selectedSpotIdRef = useRef(selectedSpotId);
  const flownKeyRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mapEpoch, setMapEpoch] = useState(0);

  spotsRef.current = spots;
  onSelectRef.current = onSelectSpot;
  selectedSpotIdRef.current = selectedSpotId;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let removed = false;
    let ready = false;
    let resizeObserver: ResizeObserver | null = null;
    let map: MapLibreMap | null = null;

    try {
      map = new MapLibreMap({
        container,
        style: CAMPUS_MAP_STYLE_URL,
        center: [longitude, latitude],
        zoom: CAMPUS_MAP_ZOOM,
      });
      mapRef.current = map;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          map?.resize();
        });
        resizeObserver.observe(container);
      }

      map.on("load", () => {
        ready = true;

        if (removed || !map) {
          return;
        }

        setFailed(false);
        map.resize();
        setMapEpoch((value) => value + 1);
      });

      map.on("error", () => {
        if (!removed && !ready) {
          setFailed(true);
        }
      });
    } catch {
      if (!removed) {
        setFailed(true);
      }
    }

    return () => {
      removed = true;
      resizeObserver?.disconnect();
      map?.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [attempt, latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || mapEpoch === 0) {
      return;
    }

    const pins = new Map<string, HTMLButtonElement>();
    const created: Marker[] = [];
    const selectedId = selectedSpotIdRef.current;

    for (const spot of spots) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "campus-pin";
      button.setAttribute("aria-label", spot.name);
      button.innerHTML = PIN_SVG;
      button.style.border = "0";
      button.style.padding = "0";
      button.style.background = "transparent";
      button.style.cursor = "pointer";
      button.style.width = "32px";
      button.style.height = "32px";
      const selected = spot.id === selectedId;
      button.style.transform = selected ? "scale(1.12)" : "scale(1)";
      button.style.zIndex = selected ? "2" : "1";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.addEventListener("click", () => onSelectRef.current(spot.id));
      pins.set(spot.id, button);
      created.push(
        new Marker({ element: button, anchor: "bottom" })
          .setLngLat([spot.longitude, spot.latitude])
          .addTo(map)
      );
    }

    pinsRef.current = pins;

    return () => {
      for (const marker of created) {
        marker.remove();
      }

      pinsRef.current = new Map();
    };
  }, [mapEpoch, spots]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || mapEpoch === 0) {
      return;
    }

    for (const [id, button] of pinsRef.current) {
      const selected = id === selectedSpotId;
      button.style.transform = selected ? "scale(1.12)" : "scale(1)";
      button.style.zIndex = selected ? "2" : "1";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }

    const flightKey = `${mapEpoch}:${selectedSpotId ?? ""}`;

    if (flownKeyRef.current === flightKey) {
      return;
    }

    flownKeyRef.current = flightKey;
    const spot = spotsRef.current.find((item) => item.id === selectedSpotId);
    map.easeTo({
      center: spot ? [spot.longitude, spot.latitude] : [longitude, latitude],
      zoom: CAMPUS_MAP_ZOOM,
    });
  }, [latitude, longitude, mapEpoch, selectedSpotId]);

  return (
    <div className="campus-map relative h-full min-h-0 w-full">
      <style>{`
        .campus-map .maplibregl-ctrl-bottom-left,
        .campus-map .maplibregl-ctrl-bottom-right {
          top: 12px;
          bottom: auto;
        }
        @media (min-width: 768px) {
          .campus-map .maplibregl-ctrl-bottom-left,
          .campus-map .maplibregl-ctrl-bottom-right {
            top: auto;
            bottom: 0;
          }
        }
      `}</style>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label={`Map of ${schoolName}`}
      />
      {failed ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-brand/90 px-6 text-center">
          <p className="font-bold text-white">The map didn’t load.</p>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-accent px-5 text-sm font-bold text-brand"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

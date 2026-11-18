"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  type: "store" | "customer" | "courier";
};

const COLORS = {
  store: "#F0B90B",
  customer: "#0ECB81",
  courier: "#EAECEF",
};

export default function MapView({
  markers,
  center,
  zoom = 13,
  className = "h-64 w-full",
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [isReady, setIsReady] = useState(false);

  const markersKey = useMemo(
    () =>
      markers
        .map((marker) => `${marker.type}:${marker.lat.toFixed(5)}:${marker.lng.toFixed(5)}`)
        .join("|"),
    [markers],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsReady(false);
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const fallbackCenter =
        center ??
        (markers.length > 0
          ? { lat: markers[0].lat, lng: markers[0].lng }
          : { lat: -33.4489, lng: -70.6693 });

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([fallbackCenter.lat, fallbackCenter.lng], zoom);

      const tiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
          maxZoom: 16,
        },
      ).addTo(map);
      tiles.on("load", () => {
        if (!cancelled) setIsReady(true);
      });
      window.setTimeout(() => {
        if (!cancelled) setIsReady(true);
      }, 3500);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      for (const marker of markers) {
        const color = COLORS[marker.type];
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:18px;height:18px;">
            <div style="position:absolute;inset:0;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${color}22, 0 0 18px ${color}66;border:2px solid #0B0E11;"></div>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([marker.lat, marker.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-size:12px;font-weight:600;color:#EAECEF">${marker.label}</div>`,
          );
      }

      if (markers.length > 1) {
        map.fitBounds(
          L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng])).pad(0.25),
        );
      }

      mapRef.current = map;
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, center?.lat, center?.lng, zoom]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa de entrega" />
      {!isReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/80 text-[11px] text-muted">
          Cargando mapa…
        </div>
      )}
    </div>
  );
  
}

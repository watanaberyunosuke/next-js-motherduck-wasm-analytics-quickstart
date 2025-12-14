"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout, Config, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type ZipcodeData = { zipcode: string | number; value: number };
type Props = { fetchData: () => Promise<ZipcodeData[]>; title?: string };
type GeoJson = any;

const ZIP_GEOJSON_URL =
  "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ny_new_york_zip_codes_geo.min.json";

const BOROUGH_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/new-york-city-boroughs.geojson";

const normalizeZip = (z: string | number) => String(z).trim().match(/\d{5}/)?.[0] ?? "";

function pickName(props: any): string {
  return props?.name || props?.Name || props?.borough || props?.BoroName || props?.boro_name || "Borough";
}

function polygonToLines(coords: any): { lons: (number | null)[]; lats: (number | null)[] } {
  const lons: (number | null)[] = [];
  const lats: (number | null)[] = [];

  for (const ring of coords ?? []) {
    for (const pt of ring ?? []) {
      lons.push(pt[0]);
      lats.push(pt[1]);
    }
    // break between rings
    lons.push(null);
    lats.push(null);
  }

  return { lons, lats };
}

function featureToLines(feature: any) {
  const geom = feature?.geometry;
  const type = geom?.type;
  const coords = geom?.coordinates;

  const lons: (number | null)[] = [];
  const lats: (number | null)[] = [];

  if (type === "Polygon") {
    const out = polygonToLines(coords);
    lons.push(...out.lons);
    lats.push(...out.lats);
  } else if (type === "MultiPolygon") {
    for (const poly of coords ?? []) {
      const out = polygonToLines(poly);
      lons.push(...out.lons);
      lats.push(...out.lats);
    }
  }

  return { lons, lats };
}

function featureCentroid(feature: any): { lon: number; lat: number } | null {
  const geom = feature?.geometry;
  const type = geom?.type;
  const coords = geom?.coordinates;

  let ring: any[] | null = null;
  if (type === "Polygon") ring = coords?.[0];
  if (type === "MultiPolygon") ring = coords?.[0]?.[0];
  if (!ring?.length) return null;

  let sumLon = 0;
  let sumLat = 0;
  let n = 0;

  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
    n += 1;
  }

  return n ? { lon: sumLon / n, lat: sumLat / n } : null;
}

export default function NYCZipcodeHeatMap({ fetchData, title = "NYC Heatmap" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<any>(null);

  const [zipGeo, setZipGeo] = useState<GeoJson | null>(null);
  const [boroughGeo, setBoroughGeo] = useState<GeoJson | null>(null);

  const [rows, setRows] = useState<ZipcodeData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load ZIP GeoJSON + borough GeoJSON + data
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [zipGJ, boroughGJ, data] = await Promise.all([
        fetch(ZIP_GEOJSON_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(BOROUGH_GEOJSON_URL, { cache: "no-store" }).then((r) => r.json()),
        fetchData(),
      ]);

      if (!cancelled) {
        setZipGeo(zipGJ);
        setBoroughGeo(boroughGJ);
        setRows(data);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const points = useMemo(
    () =>
      rows
        .map((d) => ({ zip: normalizeZip(d.zipcode), value: d.value }))
        .filter((p) => p.zip !== "" && Number.isFinite(p.value)),
    [rows]
  );

  const maxZ = useMemo(() => Math.max(...points.map((p) => p.value), 1), [points]);

  const choroplethTrace: Partial<Data>[] = useMemo(() => {
    if (!zipGeo) return [];
    return [
      {
        type: "choropleth" as const,
        geojson: zipGeo,
        featureidkey: "properties.ZCTA5CE10",
        locations: points.map((p) => p.zip),
        z: points.map((p) => p.value),
        zmin: 0,
        zmax: maxZ,
        colorscale: [
          [0, "rgb(242,240,247)"],
          [0.2, "rgb(218,218,235)"],
          [0.4, "rgb(188,189,220)"],
          [0.6, "rgb(158,154,200)"],
          [0.8, "rgb(117,107,177)"],
          [1, "rgb(84,39,143)"],
        ] as any,
        marker: { line: { width: 0.4, color: "rgba(255,255,255,0.75)" } },
        hovertemplate: "Zip: %{location}<br>Count: %{z}<extra></extra>",
        showscale: true,
      },
    ];
  }, [zipGeo, points, maxZ]);

  const boroughTraces: Partial<Data>[] = useMemo(() => {
    if (!boroughGeo?.features?.length) return [];

    const outlineLon: (number | null)[] = [];
    const outlineLat: (number | null)[] = [];

    const labelLon: number[] = [];
    const labelLat: number[] = [];
    const labelText: string[] = [];

    for (const f of boroughGeo.features) {
      const { lons, lats } = featureToLines(f);
      outlineLon.push(...lons, null);
      outlineLat.push(...lats, null);

      const c = featureCentroid(f);
      if (c) {
        labelLon.push(c.lon);
        labelLat.push(c.lat);
        labelText.push(pickName(f.properties));
      }
    }

    return [
      {
        type: "scattergeo" as const,
        mode: "lines",
        lon: outlineLon,
        lat: outlineLat,
        line: { width: 2, color: "rgba(0,0,0,0.6)" },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scattergeo" as const,
        mode: "text",
        lon: labelLon,
        lat: labelLat,
        text: labelText,
        textfont: { size: 12, color: "rgba(0,0,0,0.65)" },
        hoverinfo: "skip",
        showlegend: false,
      },
    ];
  }, [boroughGeo]);

  const layout: Partial<Layout> = useMemo(
    () => ({
      title: { text: title, font: { size: 20 } },
      geo: {
        projection: { type: "mercator" },
        fitbounds: "locations",
        showland: true,
        landcolor: "rgb(240,240,240)",
        showocean: true,
        oceancolor: "rgb(220,235,245)",
        showlakes: true,
        lakecolor: "rgb(220,235,245)",
        showframe: false,
        bgcolor: "rgba(0,0,0,0)",
      },
      margin: { t: 80, b: 0, l: 0, r: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
    }),
    [title]
  );

  const config: Partial<Config> = useMemo(
    () => ({
      responsive: false, // we resize manually (avoids _axisMatchGroups crash)
      displayModeBar: true,
      displaylogo: false,
    }),
    []
  );

  // Manual resize + refit bounds
  useEffect(() => {
    if (!containerRef.current) return;

    const ro = new ResizeObserver(() => {
      const el = plotRef.current?.el;
      const Plotly = (window as any).Plotly;
      if (!el || !Plotly?.Plots?.resize) return;

      Plotly.Plots.resize(el);

      if (zipGeo && points.length > 0 && Plotly?.relayout) {
        Plotly.relayout(el, { "geo.fitbounds": "locations" });
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [zipGeo, points.length]);

  // Fit once after first draw
  useEffect(() => {
    const el = plotRef.current?.el;
    const Plotly = (window as any).Plotly;
    if (!el || !Plotly?.relayout) return;
    if (!zipGeo || points.length === 0) return;

    const t = setTimeout(() => Plotly.relayout(el, { "geo.fitbounds": "locations" }), 0);
    return () => clearTimeout(t);
  }, [zipGeo, points.length]);

  if (loading || !zipGeo) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: 600 }}>
        <span className="text-sm text-gray-500">Loading map…</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: 600, width: "100%" }}>
      <Plot
        ref={plotRef}
        data={[...choroplethTrace, ...boroughTraces]}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

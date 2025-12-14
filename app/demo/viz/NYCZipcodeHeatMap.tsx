"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout, Config, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type ZipcodeData = { zipcode: string | number; value: number };
type Props = { fetchData: () => Promise<ZipcodeData[]>; title?: string };
type GeoJson = any;

const normalizeZip = (z: string | number) => String(z).trim().match(/\d{5}/)?.[0] ?? "";

export default function NYCZipcodeHeatMap({ fetchData, title = "NYC Heatmap" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<any>(null);

  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [rows, setRows] = useState<ZipcodeData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load GeoJSON + data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const gj = await (
        await fetch(
          "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ny_new_york_zip_codes_geo.min.json",
          { cache: "no-store" }
        )
      ).json();
      const data = await fetchData();
      if (!cancelled) {
        setGeoJson(gj);
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

  const plotData: Partial<Data>[] = useMemo(() => {
    if (!geoJson) return [];
    return [
      {
        type: "choropleth" as const,
        geojson: geoJson,
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
        marker: { line: { width: 0 } },
        hovertemplate: "Zip: %{location}<br>Count: %{z}<extra></extra>",
        showscale: true,
      },
    ];
  }, [geoJson, points, maxZ]);

  const layout: Partial<Layout> = useMemo(
    () => ({
      title: { text: title, font: { size: 20 } },
      geo: {
        projection: { type: "mercator" },
        fitbounds: "locations", // initial auto-zoom
        showland: true,
        landcolor: "rgb(240,240,240)",
        showocean: true,
        oceancolor: "rgb(220,235,245)",
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
      responsive: false, // IMPORTANT: we handle resize ourselves
      displayModeBar: true,
      displaylogo: false,
    }),
    []
  );

  // ✅ Manual resize + re-fit bounds
  useEffect(() => {
    if (!containerRef.current) return;

    const ro = new ResizeObserver(() => {
      const el = plotRef.current?.el;
      const Plotly = (window as any).Plotly;
      if (!el || !Plotly?.Plots?.resize) return;

      // Resize to new container size
      Plotly.Plots.resize(el);

      // Re-fit view to the polygons (auto-zoom)
      // (Only after data is present)
      if (geoJson && points.length > 0 && Plotly?.relayout) {
        Plotly.relayout(el, { "geo.fitbounds": "locations" });
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [geoJson, points.length]);

  // Also trigger a fit after initial draw (first time data arrives)
  useEffect(() => {
    const el = plotRef.current?.el;
    const Plotly = (window as any).Plotly;
    if (!el || !Plotly?.relayout) return;
    if (!geoJson || points.length === 0) return;

    // next tick so the plot exists
    const t = setTimeout(() => Plotly.relayout(el, { "geo.fitbounds": "locations" }), 0);
    return () => clearTimeout(t);
  }, [geoJson, points.length]);

  if (loading || !geoJson) {
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
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

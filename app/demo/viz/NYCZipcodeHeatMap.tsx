"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout, Config, ChoroplethData } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type ZipcodeData = { zipcode: string | number; value: number };
type Props = { fetchData: () => Promise<ZipcodeData[]>; title?: string };
type GeoJson = any;

const normalizeZip = (z: string | number) =>
  String(z).trim().match(/\d{5}/)?.[0] ?? "";

export default function NYCZipcodeHeatMap({ fetchData, title = "NYC Heatmap" }: Props) {
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [data, setData] = useState<ZipcodeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const gj = await (await fetch(
        "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ny_new_york_zip_codes_geo.min.json"
      )).json();
      setGeoJson(gj);

      const rows = await fetchData();
      setData(rows);
      setLoading(false);
    })();
  }, [fetchData]);

  const points = useMemo(
    () =>
      data
        .map((d) => ({ zip: normalizeZip(d.zipcode), value: d.value }))
        .filter((p) => p.zip !== "" && Number.isFinite(p.value)),
    [data]
  );

  const maxZ = useMemo(() => Math.max(...points.map((p) => p.value), 1), [points]);

  const plotData: Partial<ChoroplethData>[] = useMemo(() => {
    if (!geoJson) return [];
    return [
      {
        type: "choropleth",
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
        scope: "usa",
        projection: { type: "mercator" },
        fitbounds: "locations", // zoom to your GeoJSON locations
        visible: false,         // hides default coastlines etc
      },
      margin: { t: 80, b: 0, l: 0, r: 0 },
    }),
    [title]
  );

  const config: Partial<Config> = useMemo(
    () => ({ responsive: true, displayModeBar: true, displaylogo: false }),
    []
  );

  if (loading || !geoJson) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: 600 }}>
        <span className="text-sm text-gray-500">Loading map…</span>
      </div>
    );
  }

  return (
    <div style={{ height: 600, width: "100%" }}>
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}

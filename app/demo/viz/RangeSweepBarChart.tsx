"use client";

import React, { useState, useEffect, useCallback } from "react";
import Plot from "react-plotly.js";
import type { Layout, PlotRelayoutEvent, RangeSelector } from "plotly.js";

type YearRange = [number, number];

interface YearValue {
  year: number;
  value: number;
}

interface YearRangeBarChartProps {
  title: string;
  selectedRange: YearRange;
  onRangeChange: (range: YearRange) => void;
  fetchData: () => Promise<YearValue[]>;
}

const selectorOptions: Partial<RangeSelector> = {
  buttons: [
    { step: "all", label: "All" },
    { step: "month", stepmode: "backward", count: 1, label: "1 Month" },
    { step: "year", stepmode: "backward", count: 1, label: "1 Year" },
  ],
};

const RangeSweepBarChart: React.FC<YearRangeBarChartProps> = ({
  title,
  selectedRange,
  onRangeChange,
  fetchData,
}) => {
  const [yearData, setYearData] = useState<YearValue[]>([]);

  useEffect(() => {
    const initialFetch = async () => {
      const data = await fetchData();
      setYearData(data);
    };
    initialFetch();
  }, [fetchData]);

  const handleRelayout = useCallback(
    (event: Readonly<PlotRelayoutEvent>) => {
      if (event["xaxis.range"] !== undefined) {
        const r = event["xaxis.range"] as [unknown, unknown];
        onRangeChange([Number(r[0]), Number(r[1])]);
      } else if (
        event["xaxis.range[0]"] !== undefined &&
        event["xaxis.range[1]"] !== undefined
      ) {
        onRangeChange([
          Number(event["xaxis.range[0]"]),
          Number(event["xaxis.range[1]"]),
        ]);
      }
    },
    [onRangeChange]
  );

  const layout: Partial<Layout> = {
    title: { text: title, font: { size: 20 } },
    xaxis: {
      title: { text: "Year" },          // <- was string
      range: selectedRange,
      type: "linear",
      tickmode: "linear",
      dtick: 1,
      fixedrange: true,
      rangeselector: selectorOptions,    // <- now typed correctly
      rangeslider: {},
    },
    yaxis: {
      title: { text: "Count" },          // <- was string
      fixedrange: true,
    },
    margin: { t: 50, r: 20, b: 40, l: 60 },
    showlegend: false,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Years Selected: {Math.floor(selectedRange?.[0] + 0.5)} -{" "}
          {Math.floor(selectedRange?.[1] + 0.5)}
        </div>
      </div>

      <Plot
        data={[
          {
            type: "bar",
            x: yearData.map((d) => d.year),
            y: yearData.map((d) => d.value),
            marker: { color: "#3b82f6", opacity: 0.8 },
            hovertemplate: "Year: %{x}<br>Count: %{y}<extra></extra>",
          },
        ]}
        layout={layout}
        config={{
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: [
            "lasso2d",
            "pan2d",
            "zoom2d",
            "autoScale2d",
            "hoverClosestCartesian",
            "hoverCompareCartesian",
            "toggleSpikelines",
            "select2d",
            "toImage",
          ],
          responsive: true,
        }}
        style={{ width: "100%", height: "300px" }}
        onRelayout={handleRelayout}
      />
    </div>
  );
};

export default RangeSweepBarChart;

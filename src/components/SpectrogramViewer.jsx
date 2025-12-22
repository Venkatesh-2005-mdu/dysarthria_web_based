import React, { useMemo } from "react";
import Plot from "react-plotly.js";
import "./SpectrogramViewer.css";

/**
 * SpectrogramViewer Component
 * Displays spectrogram with resonance metrics overlay
 * Uses Plotly.js for interactive visualization
 */
const SpectrogramViewer = ({
  spectrogramData,
  frequencies,
  times,
  a1Frequency,
  p0Frequency,
  nasalityRatio,
  a1P0Difference,
  samplingRate,
}) => {
  const plotData = useMemo(() => {
    if (!spectrogramData || !frequencies || !times) {
      return [];
    }

    return [
      {
        z: spectrogramData,
        x: times,
        y: frequencies,
        type: "heatmap",
        colorscale: "Viridis",
        colorbar: {
          title: "dB",
          thickness: 20,
          len: 0.7,
        },
        name: "Spectrogram",
      },
      // A1 (Oral Peak) marker
      {
        x: [times[Math.floor(times.length / 2)]],
        y: [a1Frequency],
        mode: "markers",
        marker: {
          size: 10,
          color: "red",
          symbol: "circle",
          line: {
            color: "white",
            width: 2,
          },
        },
        name: `A1 (Oral): ${a1Frequency} Hz`,
        hovertemplate: `A1 - Oral Peak<br>Frequency: ${a1Frequency} Hz<extra></extra>`,
      },
      // P0 (Nasal Peak) marker
      {
        x: [times[Math.floor(times.length / 2)]],
        y: [p0Frequency],
        mode: "markers",
        marker: {
          size: 10,
          color: "lime",
          symbol: "diamond",
          line: {
            color: "white",
            width: 2,
          },
        },
        name: `P0 (Nasal): ${p0Frequency} Hz`,
        hovertemplate: `P0 - Nasal Peak<br>Frequency: ${p0Frequency} Hz<extra></extra>`,
      },
    ];
  }, [spectrogramData, frequencies, times, a1Frequency, p0Frequency]);

  const layout = useMemo(() => ({
    title: {
      text: "Resonance Spectrogram with LPC Spectral Envelope",
      font: {
        size: 14,
        color: "#2c3e50",
      },
    },
    xaxis: {
      title: "Time (s)",
      zeroline: false,
    },
    yaxis: {
      title: "Frequency (Hz)",
      zeroline: false,
      range: [0, 5000], // Clinical range: 0-5000 Hz
    },
    hovermode: "closest",
    plot_bgcolor: "#f8f9fa",
    paper_bgcolor: "#ffffff",
    margin: {
      l: 60,
      r: 50,
      b: 60,
      t: 60,
    },
    autosize: true,
    responsive: true,
  }), []);

  return (
    <div className="spectrogram-viewer">
      <div className="spectrogram-plot">
        <Plot
          data={plotData}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="spectrogram-legend">
        <div className="legend-title">Peak Identification</div>
        <div className="legend-item a1-peak">
          <span className="legend-marker a1"></span>
          <span className="legend-label">A1 (Oral/First Formant): {a1Frequency} Hz</span>
        </div>
        <div className="legend-item p0-peak">
          <span className="legend-marker p0"></span>
          <span className="legend-label">P0 (Nasal Peak): {p0Frequency} Hz</span>
        </div>
      </div>

      <div className="spectrogram-info">
        <div className="info-grid">
          <div className="info-item">
            <label>A1 - P0 Difference</label>
            <span className="info-value">{a1P0Difference} dB</span>
            <span className="info-unit">Key metric for nasality</span>
          </div>
          <div className="info-item">
            <label>Nasality Ratio</label>
            <span className="info-value">{nasalityRatio.toFixed(1)}%</span>
            <span className="info-unit">Nasal energy percentage</span>
          </div>
          <div className="info-item">
            <label>Nasal Band</label>
            <span className="info-value">300-700 Hz</span>
            <span className="info-unit">Clinical range</span>
          </div>
          <div className="info-item">
            <label>Oral Band</label>
            <span className="info-value">700-5000 Hz</span>
            <span className="info-unit">Clinical range</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpectrogramViewer;

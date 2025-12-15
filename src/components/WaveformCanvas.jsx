import React from "react";
import Plot from "react-plotly.js";
import "./WaveformCanvas.css";

/**
 * WaveformCanvas Component
 * Displays waveform using Plotly.js
 * Real-time updates during recording
 */
const WaveformCanvas = ({ blob, waveform = [], samplingRate = 16000, isRecording = false }) => {
  if (waveform.length === 0) {
    return (
      <div className="waveform-canvas-container">
        <div className="waveform-placeholder">Waiting for audio...</div>
        {isRecording && (
          <div className="waveform-recording-indicator">Recording...</div>
        )}
      </div>
    );
  }

  // Create time axis in seconds
  const duration = waveform.length / samplingRate;
  const timeAxis = waveform.map((_, i) => (i / samplingRate));

  // Plotly trace for waveform
  const trace = {
    x: timeAxis,
    y: waveform,
    mode: "lines",
    name: "Waveform",
    line: {
      color: "#1d3c6a",
      width: 1.5,
    },
    hovertemplate: "Time: %{x:.3f}s<br>Amplitude: %{y:.4f}<extra></extra>",
  };

  const layout = {
    title: "",
    xaxis: {
      title: "Time (s)",
      zeroline: false,
      showgrid: true,
      gridcolor: "rgba(15, 50, 88, 0.1)",
    },
    yaxis: {
      title: "Amplitude",
      zeroline: true,
      showgrid: true,
      gridcolor: "rgba(15, 50, 88, 0.1)",
      zerolinecolor: "rgba(20, 30, 50, 0.2)",
    },
    plot_bgcolor: "#ffffff",
    paper_bgcolor: "#ffffff",
    margin: { l: 60, r: 30, t: 20, b: 50 },
    hovermode: "x unified",
    showlegend: false,
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  return (
    <div className="waveform-canvas-container">
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "100%" }}
      />
      {isRecording && (
        <div className="waveform-recording-indicator">
          Recording...
        </div>
      )}
    </div>
  );
};

export default WaveformCanvas;

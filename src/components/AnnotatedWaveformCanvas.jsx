import React, { useRef, useState, forwardRef, useImperativeHandle, useMemo } from "react";
import Plot from "react-plotly.js";
import "./AnnotatedWaveformCanvas.css";

/**
 * AnnotatedWaveformCanvas Component
 * Displays raw bipolar waveform with optional syllable annotations using Plotly.js
 * Supports Base64 PNG export functionality
 * Supports real-time waveform display during recording
 * Supports playback cursor that moves with audio playback
 */
const AnnotatedWaveformCanvas = forwardRef(({
  waveform = [],
  samplingRate = 16000,
  syllablesData = [],
  timestampsData = [],
  showExportButtons = false,
  isRecording = false,
  currentPlaybackTime = 0,
  duration = 0,
}, ref) => {
  const plotRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const liveWaveformRef = useRef([]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    updateLiveWaveform,
    resetLiveWaveform,
    getLiveWaveform: () => liveWaveformRef.current,
  }));

  // Use live waveform during recording, otherwise use provided waveform
  const displayWaveform = isRecording ? liveWaveformRef.current : waveform;

  // Create time axis in seconds
  // Use actual duration if available, otherwise calculate from waveform
  const timeAxis = useMemo(() => {
    if (displayWaveform.length === 0) return [];
    
    // If duration is provided (post-recording), use it for accurate time axis
    if (duration > 0) {
      // Map waveform indices to actual time based on duration
      return displayWaveform.map((_, i) => (i / displayWaveform.length) * duration);
    }
    
    // During recording, use 3x downsampling factor
    return displayWaveform.map((_, i) => ((i * 3) / samplingRate));
  }, [displayWaveform, samplingRate, duration]);

  // Main waveform trace
  const traces = useMemo(() => {
    if (displayWaveform.length === 0) return [];

    const mainTrace = {
      x: timeAxis,
      y: displayWaveform,
      mode: "lines",
      name: "Waveform",
      line: {
        color: "#2178dc",
        width: 1.5,
      },
      hovertemplate: "Time: %{x:.3f}s<br>Amplitude: %{y:.4f}<extra></extra>",
    };

    // Add syllable annotation traces
    const annotationTraces = syllablesData.map((syllable, idx) => {
      const timestamp = timestampsData[idx] || 0;
      return {
        x: [timestamp, timestamp],
        y: [-1.2, 1.2],
        mode: "lines",
        name: `${syllable} (${timestamp.toFixed(2)}s)`,
        line: {
          color: "#ef4444",
          width: 2,
          dash: "dash",
        },
        hovertemplate: `${syllable}<br>Time: ${timestamp.toFixed(3)}s<extra></extra>`,
      };
    });

    return [mainTrace, ...annotationTraces];
  }, [displayWaveform, timeAxis, syllablesData, timestampsData]);

  const layout = useMemo(() => ({
    title: "",
    xaxis: {
      title: "Time (s)",
      zeroline: false,
      showgrid: true,
      gridcolor: "rgba(59, 130, 246, 0.1)",
    },
    yaxis: {
      title: "Amplitude",
      zeroline: true,
      showgrid: true,
      gridcolor: "rgba(59, 130, 246, 0.1)",
      zerolinecolor: "rgba(59, 130, 246, 0.3)",
      // Auto-scale Y-axis to fit all waveform data (no clipping)
    },
    plot_bgcolor: "#ffffff",
    paper_bgcolor: "#ffffff",
    margin: { l: 60, r: 30, t: 20, b: 50 },
    hovermode: "x unified",
    showlegend: syllablesData.length > 0,
    // Add playback cursor as vertical shape
    shapes: currentPlaybackTime > 0 && duration > 0 ? [
      {
        type: "line",
        x0: currentPlaybackTime,
        x1: currentPlaybackTime,
        y0: -1.2,
        y1: 1.2,
        line: {
          color: "rgba(34, 197, 94, 0.8)",
          width: 2,
          dash: "solid",
        },
        name: "Playback Position",
      }
    ] : [],
  }), [syllablesData.length, currentPlaybackTime, duration]);

  const config = useMemo(() => ({
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  }), []);

  const downloadAsPNG = async () => {
    if (!plotRef.current) return;
    setIsExporting(true);

    try {
      const gd = plotRef.current;
      // Use Plotly's built-in download function
      const svg = await Plotly.downloadImage(gd, {
        format: "png",
        width: 1200,
        height: 400,
      });
      setIsExporting(false);
    } catch (err) {
      console.error("Error downloading waveform:", err);
      setIsExporting(false);
    }
  };

  /**
   * Update live waveform data during recording
   * NO DOWNSAMPLING - display all samples at 16kHz
   */
  const updateLiveWaveform = (audioChunk) => {
    if (Array.isArray(audioChunk) && audioChunk.length > 0) {
      // Add samples without downsampling
      liveWaveformRef.current.push(...audioChunk);

      // Keep max samples for display (16kHz × ~8 seconds = 128K samples)
      const maxSamples = 128000;
      if (liveWaveformRef.current.length > maxSamples) {
        liveWaveformRef.current = liveWaveformRef.current.slice(-maxSamples);
      }
    }
  };

  /**
   * Reset live waveform
   */
  const resetLiveWaveform = () => {
    liveWaveformRef.current = [];
  };

  if (displayWaveform.length === 0) {
    return (
      <div className="annotated-waveform-container">
        <div className="waveform-placeholder">No audio data</div>
      </div>
    );
  }

  return (
    <div className="annotated-waveform-container">
      <div className="waveform-canvas-wrapper">
        <Plot
          ref={plotRef}
          data={traces}
          layout={layout}
          config={config}
          style={{ width: "100%", height: "400px" }}
        />
      </div>

      {showExportButtons && (
        <div className="waveform-controls">
          <button
            className="btn-export"
            onClick={downloadAsPNG}
            disabled={isExporting || displayWaveform.length === 0}
          >
            {isExporting ? "Downloading..." : "💾 Download PNG"}
          </button>
        </div>
      )}
    </div>
  );
});

AnnotatedWaveformCanvas.displayName = "AnnotatedWaveformCanvas";

export default AnnotatedWaveformCanvas;

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import LevelMeter from "../../components/LevelMeter";
import "./SZAssessment.css";

/**
 * SZAssessment.jsx
 * Separate S and Z recording with S/Z ratio calculation
 * Shows pathology interpretation
 */

const API_BASE = "http://localhost:8000";

const SZAssessment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const patientType = location.state?.patientType || "adult_female";

  const [stateMap, setStateMap] = useState({
    s: {
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
      isPlaying: false,
    },
    z: {
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
      isPlaying: false,
    },
  });

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeItemRef = useRef(null);
  const timerRef = useRef(null);
  const [timer, setTimer] = useState(0);

  // Request microphone permission on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        streamRef.current = s;
      })
      .catch((e) => {
        console.error("Mic permission denied", e);
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  /**
   * Upload audio blob to backend for analysis
   */
  const uploadToBackend = async (type, blob) => {
    try {
      // First decode the audio locally to get raw PCM data
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const audioData = Array.from(decoded.getChannelData(0));
      const sampleRate = decoded.sampleRate;

      // Send decoded audio data to backend
      const res = await fetch(`${API_BASE}/api/sz/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          audio_data: audioData,
          sample_rate: sampleRate,
        }),
      });

      if (!res.ok) throw new Error("Backend upload failed");

      const response = await res.json();

      setStateMap((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          duration: response.duration_sec || response.duration,
        },
      }));

      console.log("Backend response:", response);
    } catch (err) {
      console.error("Backend upload failed:", err);
    }
  };

  /**
   * Analyze audio blob locally for waveform display
   */
  const analyzeAudioBlob = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const data = decoded.getChannelData(0);
      const duration = decoded.duration;
      const sr = decoded.sampleRate;

      // Downsample for display (max 2000 points)
      const maxPoints = 2000;
      const factor = Math.ceil(data.length / maxPoints);
      const downsampled = [];

      for (let i = 0; i < data.length; i += factor) {
        downsampled.push(data[i]);
      }

      return {
        duration: parseFloat(duration.toFixed(2)),
        waveform: downsampled,
        samplingRate: sr,
      };
    } catch (e) {
      console.error("analyzeAudioBlob error", e);
      return { duration: 0, waveform: [], samplingRate: 16000 };
    }
  };

  /**
   * Start recording for S or Z
   */
  const startRecording = async (type) => {
    if (!streamRef.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = s;
      } catch (e) {
        console.error("Mic permission denied", e);
        return;
      }
    }

    // Stop previous recording if any
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    chunksRef.current = [];
    activeItemRef.current = type;

    const options = { mimeType: "audio/webm" };
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
    } catch (e) {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    }

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      // Analyze audio locally
      const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

      // Update UI state
      setStateMap((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          recording: false,
          audioUrl: url,
          blob,
          duration,
          waveform,
          samplingRate,
        },
      }));

      // Upload to backend
      uploadToBackend(type, blob);

      setTimer(0);
      clearInterval(timerRef.current);
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();
    setStateMap((prev) => ({ ...prev, [type]: { ...prev[type], recording: true } }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  /**
   * Toggle recording for S or Z
   */
  const toggleRecording = (type) => {
    const cur = stateMap[type]?.recording;
    if (cur) stopRecording();
    else startRecording(type);
  };

  /**
   * Handle audio playback
   */
  const handlePlay = async (type) => {
    const meta = stateMap[type];
    if (!meta?.audioUrl) return;

    const audio = new Audio(meta.audioUrl);
    setStateMap((prev) => ({ ...prev, [type]: { ...prev[type], isPlaying: true } }));

    audio.onended = () => {
      setStateMap((prev) => ({ ...prev, [type]: { ...prev[type], isPlaying: false } }));
    };

    audio.play();
  };

  /**
   * Calculate S/Z ratio
   */
  const calculateRatio = () => {
    const sDuration = stateMap.s?.duration || 0;
    const zDuration = stateMap.z?.duration || 0;

    if (sDuration === 0 || zDuration === 0) return null;
    return parseFloat((sDuration / zDuration).toFixed(2));
  };

  /**
   * Get pathology interpretation
   */
  const getPathologyInterpretation = () => {
    const ratio = calculateRatio();
    if (ratio === null) return null;

    if (ratio > 1.1) {
      return {
        status: "Laryngeal Pathology",
        color: "#ef4444",
        description: "S/Z ratio > 1.1 indicates possible laryngeal pathology",
      };
    } else if (ratio < 0.9) {
      return {
        status: "Respiratory Pathology",
        color: "#f59e0b",
        description: "S/Z ratio < 0.9 indicates possible respiratory pathology",
      };
    } else {
      return {
        status: "Normal",
        color: "#10b981",
        description: "S/Z ratio 0.9 - 1.1 is within normal range",
      };
    }
  };

  /**
   * Navigate back to Phonation Assessment
   */
  const handleBackToPhonation = () => {
    navigate("/assess/phonation");
  };

  /**
   * Save and return home
   */
  const handleFinish = () => {
    navigate("/assessmenthome");
  };

  const ratio = calculateRatio();
  const pathology = getPathologyInterpretation();

  return (
    <div className="sz-wrapper">
      {/* Premium Navbar */}
      <nav className="sz-navbar">
        <div className="sz-navbar-content">
          <div className="navbar-left">
            <button className="nav-back-btn" onClick={handleFinish}>← Back</button>
            <h2 className="navbar-title">S/Z Ratio Assessment</h2>
          </div>
          <div className="navbar-right">
            <div className="nav-progress">
              <span className="progress-label">Step 3 of 6</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "50%" }} />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="sz-breadcrumb">
        <span onClick={handleFinish} style={{ cursor: "pointer", color: "#3b82f6" }}>Dashboard</span>
        <span className="breadcrumb-sep">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">S/Z Ratio</span>
      </div>

      {/* Instructions Card */}
      <div className="sz-instructions glass-card">
        <h2 className="instruction-title">How to Perform the S/Z Ratio Assessment</h2>
        <p className="instruction-text">
          You will record /S/ and /Z/ sounds separately to calculate your S/Z ratio and identify potential laryngeal or respiratory pathology.
          Maintain steady, continuous sounds at a comfortable pitch and volume.
        </p>
        <div className="instruction-tips">
          <div className="tip-item">
            <span className="tip-icon">🔊</span>
            <span>Record /S/ sound first, hold for 5-10 seconds</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔊</span>
            <span>Then record /Z/ sound with same duration</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📊</span>
            <span>System will calculate the ratio automatically</span>
          </div>
        </div>
      </div>

      {/* S AND Z RECORDING SECTION */}
      <section className="sz-section">
        <div className="section-header">
          <h2 className="section-title">Record Sounds</h2>
          <p className="section-subtitle">Record /S/ and /Z/ separately for comparison</p>
        </div>
        <div className="sz-grid">
          {/* /S/ Sound */}
          <div className="sz-card glass-card">
            <div className="card-header">
              <h3 className="card-sound-label">/S/ Sound</h3>
              <div className="card-timer">
                {stateMap.s.recording ? (
                  <>
                    <div className="rec-dot" />
                    {timer.toFixed(1)}s
                  </>
                ) : stateMap.s.duration ? (
                  `${stateMap.s.duration}s`
                ) : (
                  "—"
                )}
              </div>
            </div>

            {/* Waveform Display */}
            <div className="card-waveform">
              <AnnotatedWaveformCanvas
                waveform={stateMap.s.waveform || []}
                samplingRate={stateMap.s.samplingRate || 16000}
              />
            </div>

            {/* Controls */}
            <div className="card-controls">
              <button
                className={`btn-record ${stateMap.s.recording ? "recording" : ""} ${stateMap.s.duration > 0 ? "completed" : ""}`}
                onClick={() => toggleRecording("s")}
              >
                {stateMap.s.recording ? "🛑 Stop" : stateMap.s.duration > 0 ? "🔄 Re-record" : "🎤 Record"}
              </button>
              <button
                className={`btn-play ${stateMap.s.audioUrl ? "active" : "disabled"}`}
                disabled={!stateMap.s.audioUrl}
                onClick={() => handlePlay("s")}
              >
                ▶️ Play
              </button>
            </div>

            {/* Level Meter */}
            {stateMap.s.duration > 0 && (
              <div className="card-meter">
                <LevelMeter
                  value={stateMap.s.duration}
                  maxValue={35}
                  label="/S/ Duration"
                  patientType={patientType}
                  showReference={true}
                />
              </div>
            )}
          </div>

          {/* /Z/ Sound */}
          <div className="sz-card glass-card">
            <div className="card-header">
              <h3 className="card-sound-label">/Z/ Sound</h3>
              <div className="card-timer">
                {stateMap.z.recording ? (
                  <>
                    <div className="rec-dot" />
                    {timer.toFixed(1)}s
                  </>
                ) : stateMap.z.duration ? (
                  `${stateMap.z.duration}s`
                ) : (
                  "—"
                )}
              </div>
            </div>

            {/* Waveform Display */}
            <div className="card-waveform">
              <AnnotatedWaveformCanvas
                waveform={stateMap.z.waveform || []}
                samplingRate={stateMap.z.samplingRate || 16000}
              />
            </div>

            {/* Controls */}
            <div className="card-controls">
              <button
                className={`btn-record ${stateMap.z.recording ? "recording" : ""} ${stateMap.z.duration > 0 ? "completed" : ""}`}
                onClick={() => toggleRecording("z")}
              >
                {stateMap.z.recording ? "🛑 Stop" : stateMap.z.duration > 0 ? "🔄 Re-record" : "🎤 Record"}
              </button>
              <button
                className={`btn-play ${stateMap.z.audioUrl ? "active" : "disabled"}`}
                disabled={!stateMap.z.audioUrl}
                onClick={() => handlePlay("z")}
              >
                ▶️ Play
              </button>
            </div>

            {/* Level Meter */}
            {stateMap.z.duration > 0 && (
              <div className="card-meter">
                <LevelMeter
                  value={stateMap.z.duration}
                  maxValue={35}
                  label="/Z/ Duration"
                  patientType={patientType}
                  showReference={true}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RATIO RESULTS SECTION */}
      <section className="sz-section">
        <div className="section-header">
          <h2 className="section-title">S/Z Ratio Results</h2>
          <p className="section-subtitle">Clinical analysis of phonatory function</p>
        </div>

        <div className="results-container">
          {/* Ratio Calculation */}
          <div className="results-box glass-card">
            <h3 className="results-subtitle">Ratio Calculation</h3>
            <div className="ratio-display">
              <div className="ratio-values">
                <div className="ratio-value-item">
                  <label>/S/ Duration:</label>
                  <span className="value">{stateMap.s.duration || "—"}s</span>
                </div>
                <div className="ratio-value-item">
                  <label>/Z/ Duration:</label>
                  <span className="value">{stateMap.z.duration || "—"}s</span>
                </div>
              </div>

              <div className="ratio-result">
                <div className="ratio-label">S/Z Ratio:</div>
                <div className="ratio-number">{ratio || "—"}</div>
              </div>

              {ratio && (
                <div className="ratio-meter">
                  <LevelMeter
                    value={ratio}
                    maxValue={2.0}
                    label="Ratio Value"
                    showReference={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Clinical Interpretation */}
          {pathology && (
            <div className="results-box highlight glass-card">
              <h3 className="results-subtitle">Clinical Interpretation</h3>
              <div className="pathology-display">
                <div
                  className="pathology-status"
                  style={{ borderLeftColor: pathology.color }}
                >
                  <div className="status-icon" style={{ color: pathology.color }}>
                    {pathology.status === "Normal" ? "✓" : "⚠"}
                  </div>
                  <div className="status-text">
                    <h4 style={{ color: pathology.color }}>{pathology.status}</h4>
                    <p>{pathology.description}</p>
                  </div>
                </div>

                <div className="reference-guide">
                  <h4>Reference Guide:</h4>
                  <ul>
                    <li>
                      <span className="ref-label" style={{ color: "#ef4444" }}>
                        &gt; 1.1
                      </span>
                      = Laryngeal Pathology
                    </li>
                    <li>
                      <span className="ref-label" style={{ color: "#10b981" }}>
                        0.9 - 1.1
                      </span>
                      = Normal
                    </li>
                    <li>
                      <span className="ref-label" style={{ color: "#f59e0b" }}>
                        &lt; 0.9
                      </span>
                      = Respiratory Pathology
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="btn-secondary glass-btn" onClick={handleBackToPhonation}>
            ← Back to Phonation Assessment
          </button>
          <button className="btn-primary glass-btn" onClick={handleFinish}>
            Save & Return Home
          </button>
        </div>
      </section>
    </div>
  );
};

export default SZAssessment;

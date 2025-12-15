import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import LevelMeter from "../../components/LevelMeter";
import RealtimeAudioCapture from "../../utils/realtimeAudioCapture";
import "./PhonationAssessment.css";

/**
 * PhonationAssessment.jsx
 * Updated: Vowel recording with MPD calculation and level meters
 * Records only A, II, U, UHM for MPD calculation
 */

const API_BASE = "http://localhost:8000";

const VOWEL_ITEMS = [
  { id: "a", label: "/A/" },
  { id: "ii", label: "/II/" },
  { id: "u", label: "/U/" },
  { id: "uhm", label: "/UHM/" },
];

const PhonationAssessment = () => {
  const navigate = useNavigate();
  const [permissionGranted, setPermissionGranted] = useState(null);
  const [patientType, setPatientType] = useState("adult_female"); // adult_male, adult_female, child
  const [activeRecordingId, setActiveRecordingId] = useState(null); // Track which vowel is being recorded
  
  const [stateMap, setStateMap] = useState(() =>
    VOWEL_ITEMS.reduce((acc, it) => {
      acc[it.id] = {
        recording: false,
        audioUrl: null,
        blob: null,
        duration: 0,
        waveform: [],
        samplingRate: 16000,
        isPlaying: false,
        backendDuration: null,
      };
      return acc;
    }, {})
  );

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeItemRef = useRef(null);
  const timerRef = useRef(null);
  const waveformCanvasRefsRef = useRef({});
  const audioCaptureRef = useRef(null);
  const [timer, setTimer] = useState(0);

  // Reference ranges by patient type
  const mpdReferences = {
    adult_male: { min: 25, max: 35 },
    adult_female: { min: 15, max: 25 },
    child: { min: 6, max: 15 },
  };

  // Request microphone permission on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        streamRef.current = s;
        setPermissionGranted(true);
      })
      .catch(() => {
        setPermissionGranted(false);
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
  const uploadToBackend = async (itemId, blob) => {
    try {
      // Decode audio to get raw PCM data
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const audioData = Array.from(decoded.getChannelData(0));
      const sampleRate = decoded.sampleRate;

      const res = await fetch(`${API_BASE}/phonation/upload/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vowel: itemId,
          audio_data: audioData,
          sample_rate: sampleRate,
        }),
      });

      if (!res.ok) throw new Error("Backend upload failed");

      const response = await res.json();

      // Save backend results
      setStateMap((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          backendDuration: response.duration_sec || response.duration,
          waveform: response.waveform || [],
          samplingRate: response.sampling_rate || 16000,
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
   * Start recording for a vowel item
   */
  const startRecording = async (itemId) => {
    if (!streamRef.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = s;
        setPermissionGranted(true);
      } catch (e) {
        setPermissionGranted(false);
        return;
      }
    }

    // Stop previous recording if any
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    chunksRef.current = [];
    activeItemRef.current = itemId;

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
      // Stop real-time capture
      if (audioCaptureRef.current) {
        audioCaptureRef.current.stop();
      }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      // Analyze audio locally
      const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

      // Update UI state
      setStateMap((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          recording: false,
          audioUrl: url,
          blob,
          duration,
          waveform,
          samplingRate,
        },
      }));

      // Reset waveform canvas for this specific vowel
      if (waveformCanvasRefsRef.current[itemId]) {
        waveformCanvasRefsRef.current[itemId].resetLiveWaveform();
      }

      // Upload to backend
      uploadToBackend(itemId, blob);

      setTimer(0);
      clearInterval(timerRef.current);
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();

    // Start real-time audio capture for live waveform
    try {
      audioCaptureRef.current = new RealtimeAudioCapture((audioSamples) => {
        // Update only the current vowel's waveform
        const currentWaveformRef = waveformCanvasRefsRef.current[itemId];
        if (currentWaveformRef && audioSamples.length > 0) {
          currentWaveformRef.updateLiveWaveform(audioSamples);
        }
      }, 16000);
      
      await audioCaptureRef.current.start(streamRef.current);
    } catch (err) {
      console.error("Error starting real-time audio capture:", err);
    }

    setStateMap((prev) => ({ ...prev, [itemId]: { ...prev[itemId], recording: true } }));
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
   * Toggle recording for a vowel
   */
  const toggleRecording = (id) => {
    const cur = stateMap[id]?.recording;
    if (cur) {
      // Stop recording the current vowel
      stopRecording();
    } else {
      // If a different vowel is being recorded, stop it first
      if (activeRecordingId && activeRecordingId !== id) {
        const prevRecording = stateMap[activeRecordingId]?.recording;
        if (prevRecording) {
          stopRecording();
          // Small delay to ensure proper cleanup
          setTimeout(() => {
            setActiveRecordingId(id);
            startRecording(id);
          }, 100);
          return;
        }
      }
      setActiveRecordingId(id); // Set when starting
      startRecording(id);
    }
  };

  /**
   * Close the recording layout and return to grid view
   */
  const closeRecordingLayout = () => {
    setActiveRecordingId(null);
  };

  /**
   * Handle audio playback
   */
  const handlePlay = async (id) => {
    const meta = stateMap[id];
    if (!meta?.audioUrl) return;

    const audio = new Audio(meta.audioUrl);
    setStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: true } }));
    
    audio.onended = () => {
      setStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: false } }));
    };
    
    audio.play();
  };

  /**
   * Get best MPD value (highest duration among vowels)
   */
  const getBestMPD = () => {
    const durations = VOWEL_ITEMS.map((item) => stateMap[item.id]?.duration || 0);
    return durations.length > 0 ? Math.max(...durations) : 0;
  };

  /**
   * Save waveform as PNG image
   */
  const saveWaveformAsImage = (itemId) => {
    const canvasRef = waveformCanvasRefsRef.current[itemId];
    if (!canvasRef || !canvasRef.getLiveWaveform) {
      console.error("No canvas reference found for vowel:", itemId);
      return;
    }
    
    // Export the waveform canvas
    if (canvasRef.exportToBase64) {
      canvasRef.exportToBase64();
    }
  };

  /**
   * Save waveform as audio file
   */
  const saveWaveformAsAudio = (itemId) => {
    const meta = stateMap[itemId];
    if (!meta?.audioUrl || !meta?.blob) {
      alert("No audio recording found for this vowel");
      return;
    }

    // Create download link for audio
    const link = document.createElement("a");
    link.href = meta.audioUrl;
    const vowelLabel = VOWEL_ITEMS.find((v) => v.id === itemId)?.label || itemId;
    link.download = `phonation_${vowelLabel}_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Navigate to S/Z Assessment
   */
  const handleContinueToSZ = () => {
    navigate("/assess/sz-ratio", { state: { patientType } });
  };

  /**
   * Save and return home
   */
  const handleFinish = () => {
    navigate("/assessmenthome");
  };

  const bestMPD = getBestMPD();
  const ref = mpdReferences[patientType];

  return (
    <div className="phonation-wrapper">
      {/* Premium Navbar */}
      <nav className="phonation-navbar">
        <div className="phonation-navbar-content">
          <div className="navbar-left">
            <button className="nav-back-btn" onClick={handleFinish}>← Back</button>
            <h2 className="navbar-title">Phonation Assessment</h2>
          </div>
          <div className="navbar-right">
            <div className="patient-type-selector">
              <label>Patient Type:</label>
              <select value={patientType} onChange={(e) => setPatientType(e.target.value)}>
                <option value="adult_male">Adult Male (25-35s)</option>
                <option value="adult_female">Adult Female (15-25s)</option>
                <option value="child">Child (6-15s)</option>
              </select>
            </div>
            <div className="nav-progress">
              <span className="progress-label">Step 2 of 6</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "33.33%" }} />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="phonation-breadcrumb">
        <span onClick={handleFinish} style={{ cursor: "pointer", color: "#3b82f6" }}>Dashboard</span>
        <span className="breadcrumb-sep">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Phonation</span>
      </div>

      {/* Instructions Card */}
      <div className="phonation-instructions glass-card">
        <h2 className="instruction-title">How to Perform the Phonation Assessment</h2>
        <p className="instruction-text">
          You will record 4 vowel sounds (/A/, /II/, /U/, /UHM/) to calculate your Maximum Phonation Duration (MPD). 
          Record each vowel once, maintaining a steady, comfortable pitch throughout the recording.
        </p>
        <div className="instruction-tips">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <span>Speak clearly and maintain a steady sound</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⏱️</span>
            <span>Record as long as you can comfortably maintain the vowel</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">✅</span>
            <span>Records will be analyzed automatically after each recording</span>
          </div>
        </div>
      </div>

      {/* VOWEL RECORDING SECTION */}
      <section className="phonation-section">
        <div className="section-header">
          <h2 className="section-title">Vowel Recording</h2>
          <p className="section-subtitle">Record all 4 vowels to proceed to next assessment</p>
        </div>

        {activeRecordingId ? (
          // SPLIT LAYOUT: Recording view
          <div className="recording-layout">
            {/* LEFT SIDEBAR: Small vowel cards */}
            <div className="recording-left-panel">
              <div className="vowel-compact-list">
                {VOWEL_ITEMS.map((item) => {
                  const meta = stateMap[item.id] || {};
                  const isActive = activeRecordingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`vowel-compact-card ${isActive ? "active" : ""}`}
                    >
                      <div className="compact-header">
                        <h4 className="compact-label">{item.label}</h4>
                        <div className="compact-timer">
                          {meta.recording ? (
                            <>
                              <div className="rec-dot-small" />
                              {timer.toFixed(1)}s
                            </>
                          ) : meta.duration ? (
                            `${meta.duration}s`
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>

                      <div className="compact-controls">
                        <button
                          className={`btn-record-compact ${meta.recording ? "recording" : ""} ${meta.duration > 0 ? "completed" : ""}`}
                          onClick={() => toggleRecording(item.id)}
                        >
                          {meta.recording ? "🛑" : meta.duration > 0 ? "🔄" : "🎤"}
                        </button>
                        <button
                          className={`btn-play-compact ${meta.audioUrl ? "active" : "disabled"}`}
                          disabled={!meta.audioUrl}
                          onClick={() => handlePlay(item.id)}
                        >
                          ▶️
                        </button>
                      </div>

                      {meta.duration > 0 && (
                        <div className="compact-status">
                          <span className="status-check">✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL: Large waveform display */}
            <div className="recording-right-panel">
              <div className="large-waveform-container">
                <div className="waveform-title">
                  {stateMap[activeRecordingId]?.recording ? (
                    <>
                      <span className="rec-dot-large" />
                      Recording {VOWEL_ITEMS.find(i => i.id === activeRecordingId)?.label}
                    </>
                  ) : (
                    `Waveform: ${VOWEL_ITEMS.find(i => i.id === activeRecordingId)?.label}`
                  )}
                </div>
                <div className="large-waveform-display">
                  <AnnotatedWaveformCanvas
                    ref={(ref) => {
                      if (ref) waveformCanvasRefsRef.current[activeRecordingId] = ref;
                    }}
                    waveform={stateMap[activeRecordingId]?.waveform || []}
                    samplingRate={stateMap[activeRecordingId]?.samplingRate || 16000}
                    isRecording={stateMap[activeRecordingId]?.recording}
                  />
                </div>

                {/* Save Options (visible after recording) */}
                {stateMap[activeRecordingId]?.duration > 0 && (
                  <div className="large-waveform-save-options">
                    <button
                      className="btn-save-audio"
                      onClick={() => saveWaveformAsAudio(activeRecordingId)}
                      title="Download audio file"
                    >
                      💾 Save Audio
                    </button>
                    <button
                      className="btn-save-image"
                      onClick={() => saveWaveformAsImage(activeRecordingId)}
                      title="Export waveform as image"
                    >
                      🖼️ Save Waveform
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // NORMAL LAYOUT: Grid view
          <div className="vowel-grid">
            {VOWEL_ITEMS.map((item, idx) => {
              const meta = stateMap[item.id] || {};
              return (
                <div
                  key={item.id}
                  className="vowel-card glass-card"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="card-header">
                    <h3 className="card-vowel-label">{item.label}</h3>
                    <div className="card-timer">
                      {meta.recording ? (
                        <>
                          <div className="rec-dot" />
                          {timer.toFixed(1)}s
                        </>
                      ) : meta.duration ? (
                        `${meta.duration}s`
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  {/* Waveform Display */}
                  <div className="card-waveform">
                    <AnnotatedWaveformCanvas
                      ref={(ref) => {
                        if (ref) waveformCanvasRefsRef.current[item.id] = ref;
                      }}
                      waveform={meta.waveform || []}
                      samplingRate={meta.samplingRate || 16000}
                      isRecording={meta.recording}
                    />
                  </div>

                  {/* Controls */}
                  <div className="card-controls">
                    <button
                      className={`btn-record ${meta.recording ? "recording" : ""} ${meta.duration > 0 ? "completed" : ""}`}
                      onClick={() => toggleRecording(item.id)}
                    >
                      {meta.recording ? "🛑 Stop" : meta.duration > 0 ? "🔄 Re-record" : "🎤 Record"}
                    </button>
                    <button
                      className={`btn-play ${meta.audioUrl ? "active" : "disabled"}`}
                      disabled={!meta.audioUrl}
                      onClick={() => handlePlay(item.id)}
                    >
                      ▶️ Play
                    </button>
                  </div>

                  {/* Save Options (visible after recording) */}
                  {meta.duration > 0 && (
                    <div className="card-save-options">
                      <button
                        className="btn-save-audio"
                        onClick={() => saveWaveformAsAudio(item.id)}
                        title="Download audio file"
                      >
                        💾 Save Audio
                      </button>
                      <button
                        className="btn-save-image"
                        onClick={() => saveWaveformAsImage(item.id)}
                        title="Export waveform as image"
                      >
                        🖼️ Save Waveform
                      </button>
                    </div>
                  )}

                  {/* Status */}
                  {meta.duration > 0 && (
                    <div className="card-status">
                      <span className="status-badge ready">✓ Ready</span>
                      <span className="status-value">{meta.duration}s recorded</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MPD RESULTS SECTION */}
      <section className="phonation-section">
        <div className="section-header">
          <h2 className="section-title">Maximum Phonation Duration (MPD) Results</h2>
          <p className="section-subtitle">Clinical analysis of your phonation duration</p>
        </div>
        
        <div className="results-container">
          {/* Individual MPD Values */}
          <div className="results-box glass-card">
            <h3 className="results-subtitle">Individual Sound MPD Values</h3>
            <div className="mpd-meters">
              {VOWEL_ITEMS.map((item) => (
                <div key={item.id} className="meter-group">
                  <label className="meter-sound-label">{item.label}</label>
                  <LevelMeter
                    value={stateMap[item.id]?.duration || 0}
                    maxValue={Math.max(...Object.values(mpdReferences).map(r => r.max))}
                    patientType={patientType}
                    showReference={false}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Best MPD with Clinical Reference */}
          <div className="results-box highlight glass-card">
            <h3 className="results-subtitle">Best MPD (Highest Duration)</h3>
            <div className="best-mpd-display">
              <div className="best-mpd-value">
                {bestMPD > 0 ? `${bestMPD}s` : "—"}
              </div>
              {bestMPD > 0 && (
                <div className="clinical-reference">
                  <p className="reference-text">
                    Clinical Reference ({patientType.replace("_", " ").toUpperCase()}):
                  </p>
                  <p className="reference-range">
                    {ref.min} - {ref.max} seconds
                  </p>
                  <LevelMeter
                    value={bestMPD}
                    maxValue={ref.max}
                    patientType={patientType}
                    showReference={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="btn-primary glass-btn" onClick={handleContinueToSZ}>
            Continue to S/Z Assessment →
          </button>
          <button className="btn-secondary glass-btn" onClick={handleFinish}>
            Save & Return Home
          </button>
        </div>
      </section>
    </div>
  );
};

export default PhonationAssessment;

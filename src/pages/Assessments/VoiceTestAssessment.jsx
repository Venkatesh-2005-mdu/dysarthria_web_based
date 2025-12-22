import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import RealtimeAudioCapture from "../../utils/realtimeAudioCapture";
import "./VoiceTestAssessment.css";

/**
 * VoiceTestAssessment.jsx
 * Comprehensive voice quality assessment
 * Measures: MPFR, DSI, jitter, shimmer, and overall voice quality
 * Real-time waveform recording and display
 */

const API_BASE = "http://localhost:8000";

const VOICE_TEST_ITEMS = [
  { id: "a_phonation", label: "/A/ Phonation", description: "Sustain /A/ at comfortable pitch and loudness" },
  { id: "loud_a", label: "Load /A/ Phonation", description: "Sustain /A/ at as loud a level as comfortable" },
  { id: "soft_a", label: "Soft /A/ Phonation", description: "Sustain /A/ at as soft a level as possible" },
  { id: "interrupted_a", label: "Interrupted /A/ Phonation", description: "Say /A/ repeatedly with natural breaks" },
  { id: "glide", label: "Glide", description: "Glide from lowest to highest pitch on /A/" },
  { id: "conversation", label: "Conversation", description: "Record a few sentences of natural speech" },
];

const VoiceTestAssessment = () => {
  const navigate = useNavigate();

  // Voice recording state
  const [voiceStateMap, setVoiceStateMap] = useState(() =>
    VOICE_TEST_ITEMS.reduce((acc, item) => {
      acc[item.id] = {
        recording: false,
        audioUrl: null,
        blob: null,
        duration: 0,
        waveform: [],
        samplingRate: 16000,
        isPlaying: false,
        isPaused: false,
        backendDuration: null,
        pitchMetrics: null,
        shimmerJitterMetrics: null,
        intensityMetrics: null,
        hnrF0Metrics: null,
      };
      return acc;
    }, {})
  );

  const [clinicalNotes, setClinicalNotes] = useState("");
  const [voiceQualityImpression, setVoiceQualityImpression] = useState("");
  const [activeRecordingId, setActiveRecordingId] = useState(null);  // For modal display

  // Refs and timers
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeItemRef = useRef(null);
  const timerRef = useRef(null);
  const audioInstancesRef = useRef({});
  const [timer, setTimer] = useState(0);
  const waveformCanvasRefsRef = useRef({});
  const audioCaptureRef = useRef(null);
  const [playbackState, setPlaybackState] = useState({});

  // Request microphone permission on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        streamRef.current = s;
      })
      .catch((err) => {
        console.error("Microphone permission denied", err);
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  /**
   * Analyze audio blob for voice metrics and waveform
   * Resample to 16kHz, maintain full resolution
   */
  const analyzeAudioBlob = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const data = decoded.getChannelData(0);
      const originalSr = decoded.sampleRate;
      const targetSr = 16000;

      // Resample to 16kHz if needed
      let resampledData = data;
      if (originalSr !== targetSr) {
        const ratio = targetSr / originalSr;
        const resampledLength = Math.floor(data.length * ratio);
        resampledData = new Float32Array(resampledLength);
        
        // Linear interpolation resampling
        for (let i = 0; i < resampledLength; i++) {
          const srcIndex = i / ratio;
          const srcIndexFloor = Math.floor(srcIndex);
          const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
          const fraction = srcIndex - srcIndexFloor;
          resampledData[i] = data[srcIndexFloor] * (1 - fraction) + data[srcIndexCeil] * fraction;
        }
      }

      const duration = resampledData.length / targetSr;

      // Calculate simple voice metrics
      const rms = Math.sqrt(
        Array.from(resampledData).reduce((sum, val) => sum + val * val, 0) / resampledData.length
      );

      const minVal = Math.min(...resampledData);
      const maxVal = Math.max(...resampledData);

      return {
        duration: parseFloat(duration.toFixed(2)),
        waveform: Array.from(resampledData),  // Full resolution, 16kHz resampled
        samplingRate: targetSr,
        metrics: {
          rms: parseFloat(rms.toFixed(4)),
          peakAmplitude: parseFloat(Math.max(Math.abs(minVal), Math.abs(maxVal)).toFixed(4)),
          dynamicRange: parseFloat((maxVal - minVal).toFixed(4)),
        },
      };
    } catch (e) {
      console.error("analyzeAudioBlob error", e);
      return { duration: 0, waveform: [], samplingRate: 16000, metrics: null };
    }
  };

  /**
   * Upload audio to backend for voice analysis
   */
  const uploadToBackend = async (itemId, blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const audioData = Array.from(decoded.getChannelData(0));
      const sampleRate = decoded.sampleRate;

      const res = await fetch(`${API_BASE}/voice/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_type: itemId,
          audio_data: audioData,
          sample_rate: sampleRate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Voice analysis response:", data);
        // Store backend metrics and duration if available
        setVoiceStateMap((prev) => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            backendDuration: data.duration_sec || data.duration,
            metrics: { ...prev[itemId].metrics, ...data },
          },
        }));
      }
    } catch (err) {
      console.error("Backend upload error:", err);
    }
  };

  /**
   * Start recording for a voice test
   */
  const startRecording = async (itemId) => {
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
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      // Analyze audio locally
      const { duration, waveform, samplingRate, metrics } = await analyzeAudioBlob(blob);

      // Update UI state with waveform
      setVoiceStateMap((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          recording: false,
          audioUrl: url,
          blob,
          duration,
          waveform,
          samplingRate,
          metrics,
        },
      }));

      // Reset waveform canvas for this specific test
      if (waveformCanvasRefsRef.current[itemId]) {
        waveformCanvasRefsRef.current[itemId].resetLiveWaveform();
      }

      // Upload to backend
      uploadToBackend(itemId, blob);

      // For /A/ Phonation tests, also analyze pitch
      if (itemId === "a_phonation" || itemId === "loud_a" || itemId === "soft_a") {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ac.decodeAudioData(arrayBuffer);
          const audioData = Array.from(decoded.getChannelData(0));
          const sampleRate = decoded.sampleRate;

          console.log(`[VoiceTest] Analyzing pitch for: ${itemId}`);
          
          const pitchResponse = await fetch(`${API_BASE}/api/pitch/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_data: audioData,
              sample_rate: sampleRate,
            }),
          });

          if (pitchResponse.ok) {
            const pitchData = await pitchResponse.json();
            console.log(`[VoiceTest] Pitch analysis result:`, pitchData);
            
            // Store pitch metrics in voiceStateMap
            setVoiceStateMap((prev) => ({
              ...prev,
              [itemId]: {
                ...prev[itemId],
                pitchMetrics: {
                  overall_f0_weighted_hz: pitchData.overall_f0_weighted_hz,
                  voiced_frames: pitchData.voiced_frames,
                  unvoiced_frames: pitchData.unvoiced_frames,
                },
              },
            }));
          } else {
            console.error(`Pitch analysis failed: ${pitchResponse.status}`);
          }
        } catch (err) {
          console.error("Error analyzing pitch:", err);
        }
      }

      // For Conversation test, analyze shimmer and jitter
      if (itemId === "conversation") {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ac.decodeAudioData(arrayBuffer);
          const audioData = Array.from(decoded.getChannelData(0));
          const sampleRate = decoded.sampleRate;

          // Collect all analysis results
          const metricsToUpdate = {};

          // Analyze shimmer and jitter
          console.log(`[VoiceTest] Analyzing shimmer and jitter for: ${itemId}`);
          const shimmerJitterResponse = await fetch(`${API_BASE}/api/shimmer-jitter/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_data: audioData, sample_rate: sampleRate }),
          });

          if (shimmerJitterResponse.ok) {
            const shimmerJitterData = await shimmerJitterResponse.json();
            console.log(`[VoiceTest] Shimmer and Jitter analysis result:`, shimmerJitterData);
            metricsToUpdate.shimmerJitterMetrics = {
              jitter_local_percent: shimmerJitterData.jitter_local_percent,
              shimmer_local_percent: shimmerJitterData.shimmer_local_percent,
              voiced_frames: shimmerJitterData.voiced_frames,
            };
          }

          // Analyze intensity
          console.log(`[VoiceTest] Analyzing intensity for: ${itemId}`);
          const intensityResponse = await fetch(`${API_BASE}/api/intensity/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_data: audioData, sample_rate: sampleRate }),
          });

          if (intensityResponse.ok) {
            const intensityData = await intensityResponse.json();
            console.log(`[VoiceTest] Intensity analysis result:`, intensityData);
            metricsToUpdate.intensityMetrics = {
              average_voiced_intensity_db: intensityData.average_voiced_intensity_db,
            };
          }

          // Analyze HNR and F0
          console.log(`[VoiceTest] Analyzing HNR and F0 for: ${itemId}`);
          const hnrF0Response = await fetch(`${API_BASE}/api/hnr-f0/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_data: audioData, sample_rate: sampleRate }),
          });

          console.log(`[VoiceTest] HNR-F0 Response status: ${hnrF0Response.status}`);
          if (hnrF0Response.ok) {
            const hnrF0Data = await hnrF0Response.json();
            console.log(`[VoiceTest] HNR and F0 analysis result:`, hnrF0Data);
            console.log(`[VoiceTest] hnr_db: ${hnrF0Data.hnr_db}, f0_hz: ${hnrF0Data.f0_hz}`);
            metricsToUpdate.hnrF0Metrics = {
              hnr_db: hnrF0Data.hnr_db,
              f0_hz: hnrF0Data.f0_hz,
            };
          }

          // Update state once with all metrics
          console.log(`[VoiceTest] Updating state with all metrics:`, metricsToUpdate);
          setVoiceStateMap((prev) => ({
            ...prev,
            [itemId]: {
              ...prev[itemId],
              ...metricsToUpdate,
            },
          }));
        } catch (err) {
          console.error("Error analyzing shimmer, jitter, intensity, or HNR/F0:", err);
        }
      }

      setTimer(0);
      clearInterval(timerRef.current);
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();

    // Start real-time audio capture for live waveform
    try {
      audioCaptureRef.current = new RealtimeAudioCapture((audioSamples) => {
        // Update only the current test's waveform
        const currentWaveformRef = waveformCanvasRefsRef.current[itemId];
        if (currentWaveformRef && audioSamples.length > 0) {
          currentWaveformRef.updateLiveWaveform(audioSamples);
          console.log(`[VoiceTest] Live waveform updated: ${audioSamples.length} samples`);
        } else if (!currentWaveformRef) {
          console.warn(`[VoiceTest] Waveform ref not found for: ${itemId}`);
        }
      }, 16000);
      
      await audioCaptureRef.current.start(streamRef.current);
      console.log(`[VoiceTest] Recording started for: ${itemId}`);
    } catch (err) {
      console.error("Error starting real-time audio capture:", err);
    }

    setVoiceStateMap((prev) => ({ ...prev, [itemId]: { ...prev[itemId], recording: true } }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    // Clean up RealtimeAudioCapture to properly close AudioContext
    if (audioCaptureRef.current) {
      try {
        audioCaptureRef.current.cleanup();
        audioCaptureRef.current = null;
      } catch (err) {
        console.error("Error cleaning up audio capture:", err);
      }
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  /**
   * Close the recording layout and return to grid view
   */
  const closeRecordingLayout = () => {
    console.log(`[VoiceTest] Closing modal`);
    setActiveRecordingId(null);
  };

  /**
   * Toggle recording for a voice test
   */
  const toggleRecording = (id) => {
    console.log(`[VoiceTest] toggleRecording called for: ${id}`);
    const cur = voiceStateMap[id]?.recording;
    if (cur) {
      // Stop recording the current test
      console.log(`[VoiceTest] Stopping recording for: ${id}`);
      stopRecording();
    } else {
      // If a different test is being recorded, stop it first
      if (activeItemRef.current && activeItemRef.current !== id) {
        console.log(`[VoiceTest] Different recording in progress (${activeItemRef.current}), stopping first`);
        stopRecording();
        // Small delay to ensure proper cleanup
        setTimeout(() => {
          console.log(`[VoiceTest] Opening modal for: ${id}`);
          setActiveRecordingId(id);
          startRecording(id);
        }, 100);
        return;
      }
      console.log(`[VoiceTest] Opening modal for: ${id}`);
      setActiveRecordingId(id);
      startRecording(id);
    }
  };

  /**
   * Handle audio playback with real-time cursor tracking
   */
  const handlePlay = async (id) => {
    const meta = voiceStateMap[id];
    if (!meta?.audioUrl) return;

    const audio = new Audio(meta.audioUrl);
    audioInstancesRef.current[id] = audio;
    
    setVoiceStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: true } }));
    setPlaybackState((prev) => ({ ...prev, [id]: { currentTime: 0, isPlaying: true } }));
    
    // Update playback time continuously
    audio.ontimeupdate = () => {
      setPlaybackState((prev) => ({
        ...prev,
        [id]: {
          currentTime: audio.currentTime,
          isPlaying: true,
          duration: audio.duration
        }
      }));
    };
    
    audio.onended = () => {
      setVoiceStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: false } }));
      setPlaybackState((prev) => ({ ...prev, [id]: { currentTime: 0, isPlaying: false } }));
    };
    
    audio.play();
  };

  /**
   * Handle pause/resume
   */
  const handlePauseResume = (id) => {
    const audio = audioInstancesRef.current[id];
    if (!audio) return;

    if (audio.paused) {
      audio.play();
      setVoiceStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: true } }));
      setPlaybackState((prev) => ({
        ...prev,
        [id]: { ...prev[id], isPlaying: true }
      }));
    } else {
      audio.pause();
      setVoiceStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: false } }));
      setPlaybackState((prev) => ({
        ...prev,
        [id]: { ...prev[id], isPlaying: false }
      }));
    }
  };

  /**
   * Stop audio playback
   */
  const handleStopAudio = (id) => {
    const audio = audioInstancesRef.current[id];
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setVoiceStateMap((prev) => ({ ...prev, [id]: { ...prev[id], isPlaying: false } }));
    setPlaybackState((prev) => ({ ...prev, [id]: { currentTime: 0, isPlaying: false } }));
  };

  /**
   * Clear recording
   */
  const clearRecording = (itemId) => {
    const audioUrl = voiceStateMap[itemId]?.audioUrl;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setVoiceStateMap((prev) => ({
      ...prev,
      [itemId]: {
        recording: false,
        audioUrl: null,
        blob: null,
        duration: 0,
        waveform: [],
        samplingRate: 16000,
        isPlaying: false,
        isPaused: false,
        backendDuration: null,
        pitchMetrics: null,
        shimmerJitterMetrics: null,
        intensityMetrics: null,
        hnrF0Metrics: null,
      },
    }));
  };

  /**
   * Save waveform as audio file
   */
  const saveWaveformAsAudio = (itemId) => {
    const meta = voiceStateMap[itemId];
    if (!meta?.audioUrl || !meta?.blob) {
      alert("No audio recording found for this test");
      return;
    }

    // Create download link for audio
    const link = document.createElement("a");
    link.href = meta.audioUrl;
    const testLabel = VOICE_TEST_ITEMS.find((v) => v.id === itemId)?.label || itemId;
    link.download = `voice_${testLabel}_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Save waveform as PNG image
   */
  const saveWaveformAsImage = (itemId) => {
    const canvasRef = waveformCanvasRefsRef.current[itemId];
    if (!canvasRef || !canvasRef.getLiveWaveform) {
      alert("Waveform not ready for export");
      return;
    }

    // Trigger download via Plotly's built-in function
    const plotDiv = canvasRef.plotRef?.current;
    if (plotDiv && window.Plotly) {
      const testLabel = VOICE_TEST_ITEMS.find((v) => v.id === itemId)?.label || itemId;
      window.Plotly.downloadImage(plotDiv, {
        format: "png",
        width: 1200,
        height: 400,
        filename: `voice_waveform_${testLabel}_${Date.now()}`,
      });
    }
  };

  /**
   * Navigation handlers
   */
  const handleFinish = () => {
    navigate("/assessmenthome");
  };

  return (
    <div className="voice-wrapper">
      {/* Premium Navbar */}
      <nav className="voice-navbar">
        <div className="voice-navbar-content">
          <div className="navbar-left">
            <button className="nav-back-btn" onClick={() => navigate("/assessmenthome")}>← Back</button>
            <h2 className="navbar-title">Voice Test</h2>
          </div>
          <div className="navbar-right">
            <div className="nav-progress">
              <span className="progress-label">Step 6 of 6</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="voice-breadcrumb">
        <span onClick={() => navigate("/assessmenthome")} style={{ cursor: "pointer", color: "#3b82f6" }}>Dashboard</span>
        <span className="breadcrumb-sep">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Voice Test</span>
      </div>

      {/* Instructions Card */}
      <div className="voice-instructions glass-card">
        <h2 className="instruction-title">Voice Quality Assessment</h2>
        <p className="instruction-text">
          Evaluate voice quality characteristics through sustained phonation and pitch variation tasks. 
          This assessment measures voice parameters including MPFR, DSI (Dysphonia Severity Index), jitter, shimmer, and overall voice quality.
        </p>
        <div className="instruction-tips">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <span>Record resonance sounds naturally without straining</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span>Perform each task at comfortable speed, maintain steady rhythm</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📝</span>
            <span>Add clinical observations as you progress through tests</span>
          </div>
        </div>
      </div>

      {/* VOICE TESTS SECTION */}
      <section className="voice-section">
        <div className="section-header">
          <h2 className="section-title">Voice Quality Recording</h2>
          <p className="section-subtitle">Perform all voice tests for comprehensive analysis</p>
        </div>

        {activeRecordingId ? (
          // EXPANDED LAYOUT: Recording modal
          <div className="recording-modal-overlay">
            <div className="recording-modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  {VOICE_TEST_ITEMS.find((i) => i.id === activeRecordingId)?.label}
                </h2>
                <button className="modal-close-btn" onClick={closeRecordingLayout}>✕</button>
              </div>

              <div className="modal-scrollable-content">
                {/* Large Waveform Display */}
                <div className="large-waveform-display">
                  {activeRecordingId && (
                    <AnnotatedWaveformCanvas
                      key={activeRecordingId}
                      ref={(ref) => {
                        if (ref) {
                          waveformCanvasRefsRef.current[activeRecordingId] = ref;
                          console.log(`[VoiceTest] Waveform ref assigned for: ${activeRecordingId}`);
                        }
                      }}
                      waveform={voiceStateMap[activeRecordingId]?.waveform || []}
                      samplingRate={voiceStateMap[activeRecordingId]?.samplingRate || 16000}
                      isRecording={voiceStateMap[activeRecordingId]?.recording}
                      currentPlaybackTime={playbackState[activeRecordingId]?.currentTime || 0}
                      duration={voiceStateMap[activeRecordingId]?.duration || 0}
                      showExportButtons={true}
                    />
                  )}
                </div>

                {/* Recording Status & Controls */}
                <div className="recording-controls-container">
                <div className="recording-status">
                  <span className="status-label">Recording Time:</span>
                  <span className="status-time">
                    {voiceStateMap[activeRecordingId]?.recording ? (
                      <>
                        <span className="rec-indicator">● Recording</span>
                        {timer.toFixed(1)}s
                      </>
                    ) : (
                      `${voiceStateMap[activeRecordingId]?.duration || 0}s`
                    )}
                  </span>
                </div>

                {/* Recording Control Buttons */}
                <div className="recording-button-group">
                  <button
                    className={`btn-record-large ${voiceStateMap[activeRecordingId]?.recording ? "recording" : ""}`}
                    onClick={() => toggleRecording(activeRecordingId)}
                  >
                    {voiceStateMap[activeRecordingId]?.recording ? "🛑 Stop Recording" : "🎤 Start Recording"}
                  </button>
                </div>

                {/* Playback Controls (visible after recording) */}
                {voiceStateMap[activeRecordingId]?.duration > 0 && (
                  <div className="playback-controls">
                    <button
                      className="btn-playback"
                      onClick={() => handlePlay(activeRecordingId)}
                      disabled={voiceStateMap[activeRecordingId]?.isPlaying}
                      title="Play audio"
                    >
                      ▶️ Play
                    </button>
                    <button
                      className="btn-playback pause"
                      onClick={() => handlePauseResume(activeRecordingId)}
                      disabled={!voiceStateMap[activeRecordingId]?.isPlaying}
                      title="Pause/Resume audio"
                    >
                      {playbackState[activeRecordingId]?.isPlaying ? "⏸️ Pause" : "▶️ Resume"}
                    </button>
                    <button
                      className="btn-playback stop"
                      onClick={() => handleStopAudio(activeRecordingId)}
                      disabled={!voiceStateMap[activeRecordingId]?.isPlaying}
                      title="Stop audio"
                    >
                      ⏹️ Stop
                    </button>
                    <span className="playback-time">
                      {(playbackState[activeRecordingId]?.currentTime || 0).toFixed(2)}s / {voiceStateMap[activeRecordingId]?.duration || 0}s
                    </span>
                  </div>
                )}

                {/* Pitch Metrics (for /A/ Phonation tests) */}
                {(activeRecordingId === "a_phonation" || activeRecordingId === "loud_a" || activeRecordingId === "soft_a") &&
                  voiceStateMap[activeRecordingId]?.pitchMetrics && (
                  <div className="pitch-metrics-container">
                    <h3 className="metrics-title">Pitch Analysis</h3>
                    <div className="metrics-grid">
                      <div className="metric-item">
                        <span className="metric-label">Voiced-Time Weighted Mean F0</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.pitchMetrics?.overall_f0_weighted_hz 
                            ? `${voiceStateMap[activeRecordingId].pitchMetrics.overall_f0_weighted_hz.toFixed(2)} Hz`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Voiced Frames</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.pitchMetrics?.voiced_frames || 0}
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Unvoiced Frames</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.pitchMetrics?.unvoiced_frames || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shimmer and Jitter Metrics (for Conversation test) */}
                {activeRecordingId === "conversation" &&
                  voiceStateMap[activeRecordingId]?.shimmerJitterMetrics && (
                  <div className="shimmer-jitter-metrics-container">
                    <h3 className="metrics-title">Voice Quality Metrics</h3>
                    <div className="metrics-grid">
                      <div className="metric-item">
                        <span className="metric-label">Local Jitter</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.shimmerJitterMetrics?.jitter_local_percent 
                            ? `${voiceStateMap[activeRecordingId].shimmerJitterMetrics.jitter_local_percent.toFixed(2)}%`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Local Shimmer</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.shimmerJitterMetrics?.shimmer_local_percent 
                            ? `${voiceStateMap[activeRecordingId].shimmerJitterMetrics.shimmer_local_percent.toFixed(2)}%`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Average Intensity</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.intensityMetrics?.average_voiced_intensity_db 
                            ? `${voiceStateMap[activeRecordingId].intensityMetrics.average_voiced_intensity_db.toFixed(2)} dB`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Fundamental Frequency</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.hnrF0Metrics?.f0_hz 
                            ? `${voiceStateMap[activeRecordingId].hnrF0Metrics.f0_hz.toFixed(2)} Hz`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Harmonic Noise Ratio</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.hnrF0Metrics?.hnr_db !== undefined && voiceStateMap[activeRecordingId]?.hnrF0Metrics?.hnr_db !== null
                            ? `${voiceStateMap[activeRecordingId].hnrF0Metrics.hnr_db.toFixed(2)} dB`
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Voiced Frames</span>
                        <span className="metric-value">
                          {voiceStateMap[activeRecordingId]?.shimmerJitterMetrics?.voiced_frames || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Options (visible after recording) */}
                {voiceStateMap[activeRecordingId]?.duration > 0 && (
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
          </div>
        ) : (
          // NORMAL LAYOUT: Grid view
          <div className="voice-tests-grid">
            {VOICE_TEST_ITEMS.map((item, idx) => {
              const meta = voiceStateMap[item.id] || {};
              return (
                <div
                  key={item.id}
                  className="voice-card glass-card"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="card-header">
                    <h3 className="card-title">{item.label}</h3>
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

                  <div className="card-description">{item.description}</div>

                  {/* Waveform Display */}
                  <div className="card-waveform">
                    <AnnotatedWaveformCanvas
                      ref={(ref) => {
                        if (ref) waveformCanvasRefsRef.current[item.id] = ref;
                      }}
                      waveform={meta.waveform || []}
                      samplingRate={meta.samplingRate || 16000}
                      isRecording={meta.recording}
                      currentPlaybackTime={playbackState[item.id]?.currentTime || 0}
                      duration={meta.duration || 0}
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
                    <button
                      className="btn-expand"
                      disabled={!meta.audioUrl}
                      onClick={() => setActiveRecordingId(item.id)}
                      title="Expand for detailed view"
                    >
                      ⛶ Expand
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
                        🖼️ Save Image
                      </button>
                      <button
                        className="btn-clear"
                        onClick={() => clearRecording(item.id)}
                        title="Clear recording"
                      >
                        🗑 Clear
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

      {/* CLINICAL OBSERVATIONS SECTION */}
      <section className="voice-section">
        <div className="section-header">
          <h2 className="section-title">Clinical Observations</h2>
          <p className="section-subtitle">Document voice quality findings and impressions</p>
        </div>

        <div className="observations-container">
          <div className="observation-card glass-card">
            <h3 className="card-title">Voice Quality Notes</h3>
            <textarea
              className="notes-textarea"
              placeholder="Document voice quality observations (pitch, quality, breathiness, strain, hoarseness, etc.)"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows="6"
            />
          </div>

          <div className="observation-card glass-card">
            <h3 className="card-title">Overall Impression</h3>
            <textarea
              className="notes-textarea"
              placeholder="Overall voice quality impression and recommendations"
              value={voiceQualityImpression}
              onChange={(e) => setVoiceQualityImpression(e.target.value)}
              rows="6"
            />
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <section className="voice-section">
        <div className="action-buttons">
          <button className="btn-primary glass-btn" onClick={handleFinish}>
            Save & Return Home
          </button>
        </div>
      </section>
    </div>
  );
};

export default VoiceTestAssessment;

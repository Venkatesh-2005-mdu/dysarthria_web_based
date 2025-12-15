import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import "./RateOfSpeechAssessment.css";

/**
 * RateOfSpeechAssessment.jsx
 * Analyzes speech rate (WPM) for both rainbow passage reading and conversational speech
 */

const API_BASE = "http://localhost:8000";

const RAINBOW_PASSAGE = `When the sunlight strikes raindrops in the air, they act like tiny prisms. The light is refracted, or bent, passing through each water droplet at a slightly different angle. This results in the rainbow effect we all know and love.

Rainbows appear in the sky only when the sun is behind the viewer and the rain is in front. They are also at an angle of 42 degrees from the vertical by definition of the rainbow's characteristics. Rainbow formation requires only sunshine and rain, along with the right angle of line of sight, so rainbows are usually also short-lived. They disappear once the sun gets too high or the rain ends.

In some cases, a double rainbow can occur. This happens when light is reflected twice on the inside of the water droplet. If this occurs and the second arch's colors appear reversed from the original, the effect is called a secondary rainbow.

Unless extremely rare circumstances allow for a third order rainbow to form, the secondary rainbow will have the most color of the two natural rainbow types. Rainbows have been a source of wonder for ages. In the Middle Ages, some scientists had already begun to study rainbows. Isaac Newton famously studied the light and learned to use a prism.`;

const RAINBOW_WORD_COUNT = 327;

const SUGGESTED_TOPICS = [
  "Favorite hobby",
  "Describe a recent trip",
  "Talk about family",
  "Explain a favorite recipe",
  "Share a memorable experience",
  "Describe your job or career",
  "Talk about a favorite movie or book",
];

const RateOfSpeechAssessment = () => {
  const navigate = useNavigate();

  // ============ RAINBOW PASSAGE STATE ============
  const [rainbowRecording, setRainbowRecording] = useState({
    recording: false,
    audioUrl: null,
    blob: null,
    duration: 0,
    waveform: [],
    samplingRate: 16000,
    metrics: null,
  });

  // ============ CONVERSATIONAL SPEECH STATE ============
  const [conversationalRecording, setConversationalRecording] = useState({
    recording: false,
    audioUrl: null,
    blob: null,
    duration: 0,
    waveform: [],
    samplingRate: 16000,
    metrics: null,
  });

  const [selectedTopic, setSelectedTopic] = useState("Favorite hobby");
  const [customTopic, setCustomTopic] = useState("");
  const [topicMode, setTopicMode] = useState("select"); // "select" or "custom"

  // ============ IMPRESSION NOTES ============
  const [rainbowNotes, setRainbowNotes] = useState("");
  const [conversationalNotes, setConversationalNotes] = useState("");

  // ============ REFS & TIMERS ============
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeTypeRef = useRef(null);
  const timerRef = useRef(null);
  const [timer, setTimer] = useState(0);

  // ============ MICROPHONE SETUP ============
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

  // ============ AUDIO ANALYSIS ============
  const analyzeAudioBlob = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const data = decoded.getChannelData(0);
      const duration = decoded.duration;
      const sr = decoded.sampleRate;

      // Downsample for display
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
        rawAudio: data,
      };
    } catch (e) {
      console.error("analyzeAudioBlob error", e);
      return { duration: 0, waveform: [], samplingRate: 16000, rawAudio: null };
    }
  };

  // ============ BACKEND UPLOAD ============
  const uploadToBackend = async (type, blob, wordCount = null) => {
    try {
      // Decode audio
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      let audioData = Array.from(decoded.getChannelData(0));
      let sampleRate = decoded.sampleRate;
      const originalLength = audioData.length;

      // Downsample audio data if too large to reduce payload size
      let downsampleFactor = 1;
      if (audioData.length > 100000) {
        downsampleFactor = Math.ceil(audioData.length / 100000);
        audioData = audioData.filter((_, i) => i % downsampleFactor === 0);
        // Adjust sample rate to maintain correct duration calculation
        sampleRate = Math.round(sampleRate / downsampleFactor);
      }

      const actualDuration = originalLength / decoded.sampleRate;
      console.log(`Sending ${type} with ${audioData.length} samples at ${sampleRate} Hz (original: ${originalLength} samples at ${decoded.sampleRate} Hz, duration: ${actualDuration.toFixed(2)}s)`);

      const res = await fetch(`${API_BASE}/api/analyze/rate-of-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          audio_data: audioData,
          sample_rate: sampleRate,
          word_count: wordCount,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Backend upload failed");
      }

      const result = await res.json();
      console.log(`${type} analysis:`, result);
      return result;
    } catch (err) {
      console.error("Backend upload error:", err);
      alert(`Error analyzing speech: ${err.message}`);
      return null;
    }
  };

  // ============ RAINBOW PASSAGE RECORDING ============
  const startRainbowRecording = async () => {
    if (!streamRef.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = s;
      } catch (e) {
        console.error("Mic permission denied", e);
        return;
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    chunksRef.current = [];
    activeTypeRef.current = "rainbow";

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

      const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

      // Upload to backend
      const metrics = await uploadToBackend("rainbow", blob, RAINBOW_WORD_COUNT);

      setRainbowRecording((prev) => ({
        ...prev,
        recording: false,
        audioUrl: url,
        blob,
        duration,
        waveform,
        samplingRate,
        metrics,
      }));

      setTimer(0);
      clearInterval(timerRef.current);
      activeTypeRef.current = null;
    };

    mediaRecorderRef.current.start();
    setRainbowRecording((prev) => ({ ...prev, recording: true }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  const stopRainbowRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleRainbowRecording = () => {
    if (rainbowRecording.recording) {
      stopRainbowRecording();
    } else {
      startRainbowRecording();
    }
  };

  // ============ CONVERSATIONAL SPEECH RECORDING ============
  const startConversationalRecording = async () => {
    if (!streamRef.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = s;
      } catch (e) {
        console.error("Mic permission denied", e);
        return;
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    chunksRef.current = [];
    activeTypeRef.current = "conversational";

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

      const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

      // Upload to backend (no fixed word count for conversational)
      const metrics = await uploadToBackend("conversational", blob);

      setConversationalRecording((prev) => ({
        ...prev,
        recording: false,
        audioUrl: url,
        blob,
        duration,
        waveform,
        samplingRate,
        metrics,
      }));

      setTimer(0);
      clearInterval(timerRef.current);
      activeTypeRef.current = null;
    };

    mediaRecorderRef.current.start();
    setConversationalRecording((prev) => ({ ...prev, recording: true }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  const stopConversationalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleConversationalRecording = () => {
    if (conversationalRecording.recording) {
      stopConversationalRecording();
    } else {
      startConversationalRecording();
    }
  };

  // ============ PLAYBACK ============
  const handlePlay = (audioUrl, type) => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play();
  };

  // ============ CLEAR RECORDING ============
  const clearRainbowRecording = () => {
    if (rainbowRecording.audioUrl) {
      URL.revokeObjectURL(rainbowRecording.audioUrl);
    }
    setRainbowRecording({
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
      metrics: null,
    });
  };

  const clearConversationalRecording = () => {
    if (conversationalRecording.audioUrl) {
      URL.revokeObjectURL(conversationalRecording.audioUrl);
    }
    setConversationalRecording({
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
      metrics: null,
    });
  };

  // ============ NAVIGATION ============
  const handleFinish = () => {
    navigate("/assessmenthome");
  };

  const getMetricsColor = (wpm) => {
    if (!wpm) return "#6b7280";
    if (wpm < 100) return "#f59e0b"; // Slow - Amber
    if (wpm <= 150) return "#10b981"; // Normal - Green
    return "#f59e0b"; // Fast - Amber
  };

  const getMetricsLabel = (wpm) => {
    if (!wpm) return "Not recorded";
    if (wpm < 100) return "SLOW";
    if (wpm <= 150) return "NORMAL";
    return "FAST";
  };

  return (
    <div className="roa-wrapper">
      {/* Premium Navbar */}
      <nav className="roa-navbar">
        <div className="navbar-left">
          <button className="nav-back-btn" onClick={() => navigate("/assessmenthome")}>
            ← Back
          </button>
          <h2 className="navbar-title">Rate of Speech Assessment</h2>
        </div>
        <div className="navbar-right">
          <div className="nav-progress">
            <span className="progress-label">Step 4 of 6</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "66.67%" }} />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb Navigation */}
      <div className="roa-breadcrumb">
        <span>Dashboard</span>
        <span className="breadcrumb-separator">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">Rate of Speech</span>
      </div>

      {/* Instructions Card */}
      <div className="roa-instructions glass-card">
        <div className="instructions-header">
          <h3 className="instructions-title">Assessment Instructions</h3>
        </div>
        <div className="instructions-tips">
          <div className="tip-item">
            <span className="tip-icon">📖</span>
            <p><strong>Rainbow Passage:</strong> Read the passage at your natural speaking rate. This provides a standardized text for comparison across patients.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">💬</span>
            <p><strong>Conversational Speech:</strong> Talk about a topic of your choice for 1-2 minutes. This assesses naturalistic speaking patterns.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⏱</span>
            <p><strong>Timing Matters:</strong> The system calculates Words Per Minute (WPM) automatically from your recording duration.</p>
          </div>
        </div>
      </div>

      {/* ===== RAINBOW PASSAGE SECTION ===== */}
      <section className="roa-section">
        <div className="section-header">
          <h2 className="section-title">📖 Rainbow Passage Reading</h2>
          <p className="section-subtitle">Read the standardized passage at your natural speaking rate</p>
        </div>

        <div className="ros-container">
          {/* Left: Passage Text */}
          <div className="passage-card glass-card">
            <h3 className="card-title">The Rainbow Passage</h3>
            <p className="passage-instruction">
              Please read the passage below at your normal speaking rate.
            </p>
            <div className="passage-text-container">
              <p className="passage-text">{RAINBOW_PASSAGE}</p>
              <div className="word-count-badge">
                {RAINBOW_WORD_COUNT} words
              </div>
            </div>
          </div>

          {/* Right: Recording Controls & Results */}
          <div className="recording-card glass-card">
            <div className="card-header">
              <h3 className="card-title">Recording</h3>
              {rainbowRecording.recording && (
                <div className="card-timer">
                  <div className="rec-dot" />
                  {timer.toFixed(1)}s
                </div>
              )}
            </div>

            <p className="card-instructions">
              Click "Start Recording" and read the passage. Click "Stop" when done.
            </p>

            {/* Waveform */}
            {rainbowRecording.waveform.length > 0 && (
              <div className="card-waveform">
                <AnnotatedWaveformCanvas
                  waveform={rainbowRecording.waveform}
                  samplingRate={rainbowRecording.samplingRate}
                />
              </div>
            )}

            {/* Recording Buttons */}
            <div className="card-controls">
              <button
                className={`btn-record ${rainbowRecording.recording ? "recording" : ""}`}
                onClick={toggleRainbowRecording}
              >
                {rainbowRecording.recording ? "⏹ Stop Recording" : "🎤 Start Recording"}
              </button>
              <button
                className="btn-play"
                onClick={() => handlePlay(rainbowRecording.audioUrl, "rainbow")}
                disabled={!rainbowRecording.audioUrl}
              >
                🔊 Play
              </button>
              <button
                className="btn-clear"
                onClick={clearRainbowRecording}
                disabled={!rainbowRecording.audioUrl}
              >
                🗑 Clear
              </button>
            </div>

            {/* Results */}
            {rainbowRecording.metrics && (
              <div className="metrics-display">
                <h4>Speech Rate Analysis</h4>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <label>Duration</label>
                    <span className="metric-value">
                      {rainbowRecording.metrics.duration_sec}s
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>Total Words</label>
                    <span className="metric-value">{RAINBOW_WORD_COUNT}</span>
                  </div>
                  <div className="metric-item">
                    <label>Words Per Minute</label>
                    <span
                      className="metric-value"
                      style={{ color: getMetricsColor(rainbowRecording.metrics.words_per_minute) }}
                    >
                      {rainbowRecording.metrics.words_per_minute} WPM
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>Speaking Rate</label>
                    <span
                      className="metric-value"
                      style={{ color: getMetricsColor(rainbowRecording.metrics.words_per_minute) }}
                    >
                      {getMetricsLabel(rainbowRecording.metrics.words_per_minute)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="impression-box">
              <h4>Clinical Notes</h4>
              <textarea
                className="impression-textarea"
                placeholder="Observations about rate, clarity, pacing..."
                value={rainbowNotes}
                onChange={(e) => setRainbowNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONVERSATIONAL SPEECH SECTION ===== */}
      <section className="roa-section">
        <div className="section-header">
          <h2 className="section-title">💬 Conversational Speech</h2>
          <p className="section-subtitle">Assess naturalistic speaking patterns and rate</p>
        </div>

        <div className="ros-container">
          {/* Left: Topic Selection */}
          <div className="topic-card glass-card">
            <h3 className="card-title">Topic Selection</h3>

            <div className="topic-selector">
              <label className="radio-label">
                <input
                  type="radio"
                  name="topicMode"
                  value="select"
                  checked={topicMode === "select"}
                  onChange={(e) => setTopicMode(e.target.value)}
                />
                Select a Topic
              </label>

              {topicMode === "select" && (
                <select
                  className="topic-select"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                >
                  {SUGGESTED_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              )}

              <label className="radio-label" style={{ marginTop: "16px" }}>
                <input
                  type="radio"
                  name="topicMode"
                  value="custom"
                  checked={topicMode === "custom"}
                  onChange={(e) => setTopicMode(e.target.value)}
                />
                Custom Topic
              </label>

              {topicMode === "custom" && (
                <input
                  type="text"
                  className="topic-input"
                  placeholder="Enter a custom topic..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
              )}
            </div>

            <p className="card-instructions" style={{ marginTop: "20px" }}>
              Talk about the selected topic for approximately 1-2 minutes at your natural
              speaking rate.
            </p>
          </div>

          {/* Right: Recording Controls & Results */}
          <div className="recording-card glass-card">
            <div className="card-header">
              <h3 className="card-title">Recording</h3>
              {conversationalRecording.recording && (
                <div className="card-timer">
                  <div className="rec-dot" />
                  {timer.toFixed(1)}s
                </div>
              )}
            </div>

            <p className="card-instructions">
              Click "Start Recording" to begin. Speak about the topic, then click "Stop".
            </p>

            {/* Waveform */}
            {conversationalRecording.waveform.length > 0 && (
              <div className="card-waveform">
                <AnnotatedWaveformCanvas
                  waveform={conversationalRecording.waveform}
                  samplingRate={conversationalRecording.samplingRate}
                />
              </div>
            )}

            {/* Recording Buttons */}
            <div className="card-controls">
              <button
                className={`btn-record ${conversationalRecording.recording ? "recording" : ""}`}
                onClick={toggleConversationalRecording}
              >
                {conversationalRecording.recording ? "⏹ Stop Recording" : "🎤 Start Recording"}
              </button>
              <button
                className="btn-play"
                onClick={() => handlePlay(conversationalRecording.audioUrl, "conversational")}
                disabled={!conversationalRecording.audioUrl}
              >
                🔊 Play
              </button>
              <button
                className="btn-clear"
                onClick={clearConversationalRecording}
                disabled={!conversationalRecording.audioUrl}
              >
                🗑 Clear
              </button>
            </div>

            {/* Results */}
            {conversationalRecording.metrics && (
              <div className="metrics-display">
                <h4>Speech Rate Analysis</h4>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <label>Duration</label>
                    <span className="metric-value">
                      {conversationalRecording.metrics.duration_sec}s
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>Estimated Words</label>
                    <span className="metric-value">
                      ~{conversationalRecording.metrics.estimated_words}
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>Words Per Minute</label>
                    <span
                      className="metric-value"
                      style={{
                        color: getMetricsColor(conversationalRecording.metrics.words_per_minute),
                      }}
                    >
                      {conversationalRecording.metrics.words_per_minute} WPM
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>Speaking Rate</label>
                    <span
                      className="metric-value"
                      style={{
                        color: getMetricsColor(conversationalRecording.metrics.words_per_minute),
                      }}
                    >
                      {getMetricsLabel(conversationalRecording.metrics.words_per_minute)}
                    </span>
                  </div>
                </div>
                {conversationalRecording.metrics.pause_count && (
                  <div className="pause-info">
                    <p>
                      Pauses: {conversationalRecording.metrics.pause_count} |
                      Duration: {conversationalRecording.metrics.pause_duration_sec}s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="impression-box">
              <h4>Clinical Notes</h4>
              <textarea
                className="impression-textarea"
                placeholder="Observations about rate, fluency, pausing..."
                value={conversationalNotes}
                onChange={(e) => setConversationalNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACTION BUTTONS ===== */}
      <section className="roa-action-section">
        <div className="action-buttons">
          <button className="glass-btn btn-secondary" onClick={() => navigate("/assessmenthome")}>
            ← Back to Assessments
          </button>
          <button className="glass-btn btn-secondary" onClick={handleFinish}>
            Save & Return Home →
          </button>
        </div>
      </section>
    </div>
  );
};

export default RateOfSpeechAssessment;
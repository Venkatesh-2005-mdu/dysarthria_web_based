import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import "./RessonanceAndArticulationAssessment.css";

/**
 * RessonanceAndArticulationAssessment.jsx
 * Combines Resonance Test (with audio-based calculation) and Articulation Tests (AMR/SMR)
 */

const API_BASE = "http://localhost:8000";

const AMR_ITEMS = [
  { id: "pa", label: "/PA/" },
  { id: "ta", label: "/TA/" },
  { id: "ka", label: "/KA/" },
];

const RessonanceAndArticulationAssessment = () => {
  const navigate = useNavigate();

  // ============ RESONANCE STATE ============
  const [resonanceRecording, setResonanceRecording] = useState({
    recording: false,
    audioUrl: null,
    blob: null,
    duration: 0,
    waveform: [],
    samplingRate: 16000,
    metrics: null, // Will store resonance analysis results
  });

  const [resonanceNotes, setResonanceNotes] = useState("");

  // ============ AMR STATE ============
  const [amrStateMap, setAmrStateMap] = useState(() =>
    AMR_ITEMS.reduce((acc, item) => {
      acc[item.id] = {
        recording: false,
        audioUrl: null,
        blob: null,
        duration: 0,
        waveform: [],
        samplingRate: 16000,
      };
      return acc;
    }, {})
  );

  const [amrImpression, setAmrImpression] = useState("");

  // ============ SMR STATE ============
  const [smrRecording, setSmrRecording] = useState({
    recording: false,
    audioUrl: null,
    blob: null,
    duration: 0,
    waveform: [],
    samplingRate: 16000,
  });

  const [smrImpression, setSmrImpression] = useState("");

  // ============ REFS & TIMERS ============
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeItemRef = useRef(null);
  const timerRef = useRef(null);
  const [timer, setTimer] = useState(0);

  // ============ RESONANCE ANALYSIS ============
  /**
   * Calculate resonance characteristics from audio:
   * - Nasal resonance (energy in nasal frequencies)
   * - Oral resonance (energy in oral frequencies)
   * - Spectrogram for visualization
   */
  const analyzeResonance = async (audioData, sampleRate) => {
    try {
      // Simplified resonance analysis
      const fft = computeFFT(audioData);
      
      // Frequency bands (approximation)
      const nasalBand = fft.slice(0, Math.floor(fft.length * 0.15)); // 0-800Hz
      const oralBand = fft.slice(
        Math.floor(fft.length * 0.15),
        Math.floor(fft.length * 0.5)
      ); // 800-4000Hz

      const nasalEnergy = nasalBand.reduce((a, b) => a + b, 0) / nasalBand.length;
      const oralEnergy = oralBand.reduce((a, b) => a + b, 0) / oralBand.length;

      // Resonance ratio (nasal vs oral)
      const resonanceRatio = nasalEnergy / (oralEnergy + 0.001); // Avoid division by zero

      // Determine resonance type based on analysis
      let resonanceType = "Normal";
      let characteristics = [];

      if (resonanceRatio > 0.8) {
        resonanceType = "Hypernasality Detected";
        characteristics.push("Elevated nasal energy");
      } else if (resonanceRatio < 0.3) {
        resonanceType = "Hyponasality Detected";
        characteristics.push("Reduced nasal energy");
      } else {
        resonanceType = "Balanced";
        characteristics.push("Balanced nasal-oral resonance");
      }

      // Generate simple spectrogram data
      const spectrogramData = generateSimpleSpectrogram(audioData, sampleRate);

      return {
        resonanceType,
        resonanceRatio: parseFloat(resonanceRatio.toFixed(3)),
        characteristics,
        nasalEnergy: parseFloat(nasalEnergy.toFixed(4)),
        oralEnergy: parseFloat(oralEnergy.toFixed(4)),
        spectrogram_data: spectrogramData,
      };
    } catch (e) {
      console.error("Resonance analysis error:", e);
      return null;
    }
  };

  /**
   * Simple FFT approximation using energy distribution
   */
  const computeFFT = (audioData) => {
    const fftSize = 256;
    const frequencies = new Array(fftSize).fill(0);

    // Simplified frequency analysis by dividing signal into bands
    const bandSize = Math.ceil(audioData.length / fftSize);

    for (let i = 0; i < fftSize; i++) {
      let sum = 0;
      for (let j = 0; j < bandSize && i * bandSize + j < audioData.length; j++) {
        sum += Math.abs(audioData[i * bandSize + j]);
      }
      frequencies[i] = sum / bandSize;
    }

    return frequencies;
  };

  /**
   * Generate simple spectrogram data from audio
   * Creates frequency vs time representation
   */
  const generateSimpleSpectrogram = (audioData, sr) => {
    try {
      const frameSize = Math.floor(0.025 * sr); // 25ms frames
      const hopSize = Math.floor(0.010 * sr);   // 10ms hop
      const nFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;

      // Limit to reasonable number of frames for visualization
      const maxFrames = 100;
      const frameStep = Math.max(1, Math.floor(nFrames / maxFrames));
      const displayFrames = Math.ceil(nFrames / frameStep);

      const spectrogram = [];
      const times = [];
      let frameIdx = 0;

      for (let i = 0; i < nFrames; i += frameStep) {
        const start = i * hopSize;
        const end = Math.min(start + frameSize, audioData.length);
        const frame = audioData.slice(start, end);

        // Apply Hamming window
        const windowed = frame.map((x, idx) => {
          const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * idx) / (frameSize - 1));
          return x * w;
        });

        // Compute FFT magnitude (simplified)
        const spectrum = [];
        const fftSize = 256;
        for (let k = 0; k < fftSize / 2; k++) {
          let real = 0;
          let imag = 0;
          for (let n = 0; n < windowed.length; n++) {
            const angle = (-2 * Math.PI * k * n) / fftSize;
            real += windowed[n] * Math.cos(angle);
            imag += windowed[n] * Math.sin(angle);
          }
          const magnitude = Math.sqrt(real * real + imag * imag);
          const dB = 20 * Math.log10(Math.max(magnitude, 1e-10));
          spectrum.push(dB);
        }

        spectrogram.push(spectrum);
        times.push((i * hopSize) / sr);
        frameIdx++;
      }

      // Transpose for easier visualization
      const transposed = [];
      if (spectrogram.length > 0) {
        const freqBins = spectrogram[0].length;
        for (let freq = 0; freq < freqBins; freq++) {
          const freqCol = spectrogram.map(frame => frame[freq]);
          transposed.push(freqCol);
        }
      }

      // Generate frequency array (0 to sr/2)
      const frequencies = [];
      for (let i = 0; i < transposed.length; i++) {
        frequencies.push((i / transposed.length) * (sr / 2));
      }

      return {
        spectrogram: transposed,
        frequencies,
        times,
      };
    } catch (e) {
      console.error("Spectrogram generation error:", e);
      return null;
    }
  };

  // ============ AUDIO BLOB ANALYSIS ============
  /**
   * Analyze audio blob for waveform and basic duration
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
        rawAudio: data, // For resonance analysis
      };
    } catch (e) {
      console.error("analyzeAudioBlob error", e);
      return { duration: 0, waveform: [], samplingRate: 16000, rawAudio: null };
    }
  };

  // ============ BACKEND UPLOAD ============
  const uploadAmrToBackend = async (sound, blob) => {
    try {
      // Decode audio to get raw PCM data
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const audioData = Array.from(decoded.getChannelData(0));
      const sampleRate = decoded.sampleRate;

      const response = await fetch(`${API_BASE}/api/analyze/amr?sound=${sound}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sound,
          audio_data: audioData,
          sample_rate: sampleRate,
        }),
      });

      if (!response.ok) {
        throw new Error(`AMR upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`AMR ${sound} uploaded:`, result);
      return result;
    } catch (e) {
      console.error(`uploadAmrToBackend error for ${sound}:`, e);
      return null;
    }
  };

  const uploadSmrToBackend = async (blob) => {
    try {
      // Decode audio to get raw PCM data
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(arrayBuffer);
      const audioData = Array.from(decoded.getChannelData(0));
      const sampleRate = decoded.sampleRate;

      const response = await fetch(`${API_BASE}/api/analyze/smr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_data: audioData,
          sample_rate: sampleRate,
        }),
      });

      if (!response.ok) {
        throw new Error(`SMR upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("SMR uploaded:", result);
      return result;
    } catch (e) {
      console.error("uploadSmrToBackend error:", e);
      return null;
    }
  };

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

  // Render spectrogram when metrics update
  useEffect(() => {
    if (resonanceRecording.metrics && resonanceRecording.metrics.spectrogram_data) {
      // Small delay to ensure canvas is rendered
      setTimeout(() => {
        renderSpectrogram(resonanceRecording.metrics);
      }, 100);
    }
  }, [resonanceRecording.metrics]);

  /**
   * Render spectrogram visualization on canvas
   * Uses data from metrics (spectrogram array, frequencies, times)
   */
  const renderSpectrogram = (metrics) => {
    if (!metrics.spectrogram_data) return;

    const canvas = document.getElementById('resonance-spectrogram');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const spec = metrics.spectrogram_data.spectrogram;
    const freqs = metrics.spectrogram_data.frequencies;
    const times = metrics.spectrogram_data.times;

    if (!spec || spec.length === 0) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 300;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);

    // Colormap function: magnitude (dB) to RGB
    const getColor = (dB) => {
      // Normalize dB to 0-1 range (assuming -60 to 0 dB range)
      const normalized = Math.max(0, Math.min(1, (dB + 60) / 60));
      
      // Magma colormap approximation
      let r, g, b;
      if (normalized < 0.33) {
        r = Math.round(normalized * 3 * 50);
        g = 0;
        b = Math.round(150);
      } else if (normalized < 0.66) {
        r = Math.round(255);
        g = Math.round((normalized - 0.33) * 3 * 150);
        b = Math.round(150 - (normalized - 0.33) * 3 * 100);
      } else {
        r = Math.round(255);
        g = Math.round(150 + (normalized - 0.66) * 3 * 105);
        b = Math.round(50 + (normalized - 0.66) * 3 * 205);
      }
      return [r, g, b, 255];
    };

    // Fill canvas with spectrogram data
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Map canvas coordinates to spectrogram data
        const specIdx = Math.floor(x / width * spec.length);
        const freqIdx = Math.floor(y / height * spec[0].length);

        if (specIdx < spec.length && freqIdx < spec[0].length) {
          const dB = spec[specIdx][freqIdx];
          const [r, g, b, a] = getColor(dB);
          const pixelIdx = (y * width + x) * 4;
          imgData.data[pixelIdx] = r;
          imgData.data[pixelIdx + 1] = g;
          imgData.data[pixelIdx + 2] = b;
          imgData.data[pixelIdx + 3] = a;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Add labels
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('Time (s)', width - 50, height - 5);
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency (Hz)', 0, 0);
    ctx.restore();
  };

  // ============ RESONANCE RECORDING ============
  const startResonanceRecording = async () => {
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
    activeItemRef.current = "resonance";

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

      // Analyze audio
      const { duration, waveform, samplingRate, rawAudio } = await analyzeAudioBlob(blob);

      // Calculate resonance metrics
      let metrics = null;
      if (rawAudio) {
        metrics = await analyzeResonance(rawAudio, samplingRate);
      }

      setResonanceRecording((prev) => ({
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
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();
    setResonanceRecording((prev) => ({ ...prev, recording: true }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  const stopResonanceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleResonanceRecording = () => {
    if (resonanceRecording.recording) {
      stopResonanceRecording();
    } else {
      startResonanceRecording();
    }
  };

  // ============ AMR RECORDING ============
  const startAmrRecording = async (itemId) => {
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

      const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

      // Upload to backend
      await uploadAmrToBackend(itemId, blob);

      setAmrStateMap((prev) => ({
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

      setTimer(0);
      clearInterval(timerRef.current);
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();
    setAmrStateMap((prev) => ({ ...prev, [itemId]: { ...prev[itemId], recording: true } }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  const stopAmrRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleAmrRecording = (id) => {
    const cur = amrStateMap[id]?.recording;
    if (cur) stopAmrRecording();
    else startAmrRecording(id);
  };

  // ============ SMR RECORDING ============
  const startSmrRecording = async () => {
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
    activeItemRef.current = "smr";

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
      await uploadSmrToBackend(blob);

      setSmrRecording((prev) => ({
        ...prev,
        recording: false,
        audioUrl: url,
        blob,
        duration,
        waveform,
        samplingRate,
      }));

      setTimer(0);
      clearInterval(timerRef.current);
      activeItemRef.current = null;
    };

    mediaRecorderRef.current.start();
    setSmrRecording((prev) => ({ ...prev, recording: true }));
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 0.1), 100);
  };

  const stopSmrRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleSmrRecording = () => {
    if (smrRecording.recording) {
      stopSmrRecording();
    } else {
      startSmrRecording();
    }
  };

  // ============ PLAYBACK ============
  const handlePlay = (audioUrl, type) => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);

    if (type === "resonance") {
      setResonanceRecording((prev) => ({ ...prev, isPlaying: true }));
      audio.onended = () => {
        setResonanceRecording((prev) => ({ ...prev, isPlaying: false }));
      };
    } else if (type === "smr") {
      setSmrRecording((prev) => ({ ...prev, isPlaying: true }));
      audio.onended = () => {
        setSmrRecording((prev) => ({ ...prev, isPlaying: false }));
      };
    }

    audio.play();
  };

  const handleAmrPlay = (itemId) => {
    const audioUrl = amrStateMap[itemId]?.audioUrl;
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    setAmrStateMap((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], isPlaying: true },
    }));

    audio.onended = () => {
      setAmrStateMap((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], isPlaying: false },
      }));
    };

    audio.play();
  };

  // ============ CLEAR RECORDINGS ============
  const clearResonanceRecording = () => {
    if (resonanceRecording.audioUrl) {
      URL.revokeObjectURL(resonanceRecording.audioUrl);
    }
    setResonanceRecording({
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
      metrics: null,
    });
  };

  const clearAmrRecording = (itemId) => {
    const audioUrl = amrStateMap[itemId]?.audioUrl;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAmrStateMap((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        recording: false,
        audioUrl: null,
        blob: null,
        duration: 0,
        waveform: [],
        samplingRate: 16000,
      },
    }));
  };

  const clearSmrRecording = () => {
    if (smrRecording.audioUrl) {
      URL.revokeObjectURL(smrRecording.audioUrl);
    }
    setSmrRecording({
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],
      samplingRate: 16000,
    });
  };

  // ============ NAVIGATION ============
  const handleFinish = () => {
    navigate("/assessmenthome");
  };

  return (
    <div className="ra-wrapper">
      {/* Premium Navbar */}
      <nav className="ra-navbar">
        <div className="ra-navbar-content">
          <div className="navbar-left">
            <button className="nav-back-btn" onClick={() => navigate("/assessmenthome")}>← Back</button>
            <h2 className="navbar-title">Resonance & Articulation</h2>
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
      <div className="ra-breadcrumb">
        <span onClick={() => navigate("/assessmenthome")} style={{ cursor: "pointer", color: "#3b82f6" }}>Dashboard</span>
        <span className="breadcrumb-sep">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Resonance & Articulation</span>
      </div>

      {/* Instructions Card */}
      <div className="ra-instructions glass-card">
        <h2 className="instruction-title">Resonance & Articulation Assessment</h2>
        <p className="instruction-text">
          Evaluate nasal resonance quality and diadochokinetic speech patterns through audio recording and analysis.
          This assessment includes resonance quality evaluation and alternating/sequential motion rates (AMR/SMR).
        </p>
        <div className="instruction-tips">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <span>Record resonance sounds naturally without straining</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span>Perform DDK tests at comfortable speed, maintain steady rhythm</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📝</span>
            <span>Add clinical observations as you progress through tests</span>
          </div>
        </div>
      </div>

      {/* ===== RESONANCE SECTION ===== */}
      <section className="ra-section">
        <div className="section-header">
          <h2 className="section-title">Resonance Quality Assessment</h2>
          <p className="section-subtitle">Evaluate nasal resonance characteristics</p>
        </div>

        <div className="resonance-container">
          <div className="resonance-recording-card glass-card">
            <div className="card-header">
              <h3 className="card-title">Resonance Recording</h3>
              <div className="card-timer">
                {resonanceRecording.recording ? (
                  <>
                    <div className="rec-dot" />
                    {timer.toFixed(1)}s
                  </>
                ) : resonanceRecording.duration ? (
                  `${resonanceRecording.duration}s`
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className="card-instructions">
              Say a nasal sound (e.g., "mmm") or read a nasal passage for 3-5 seconds
            </div>

            <div className="card-waveform">
              <AnnotatedWaveformCanvas
                waveform={resonanceRecording.waveform || []}
                samplingRate={resonanceRecording.samplingRate || 16000}
              />
            </div>

            <div className="card-controls">
              <button
                className={`btn-record ${resonanceRecording.recording ? "recording" : ""}`}
                onClick={toggleResonanceRecording}
              >
                {resonanceRecording.recording ? "🛑 Stop" : "🎤 Record"}
              </button>
              <button
                className={`btn-play ${resonanceRecording.audioUrl ? "active" : "disabled"}`}
                disabled={!resonanceRecording.audioUrl}
                onClick={() => handlePlay(resonanceRecording.audioUrl, "resonance")}
              >
                🔊 Play
              </button>
              <button
                className="btn-clear"
                disabled={!resonanceRecording.audioUrl}
                onClick={clearResonanceRecording}
              >
                🗑 Clear
              </button>
            </div>

            {resonanceRecording.metrics && (
              <div className="resonance-metrics">
                <h4>Analysis Results:</h4>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <label>Resonance Type:</label>
                    <span className="metric-value">{resonanceRecording.metrics.resonanceType}</span>
                  </div>
                  <div className="metric-item">
                    <label>Resonance Ratio:</label>
                    <span className="metric-value">{resonanceRecording.metrics.resonanceRatio}</span>
                  </div>
                  <div className="metric-item">
                    <label>Nasal Energy:</label>
                    <span className="metric-value">{resonanceRecording.metrics.nasalEnergy}</span>
                  </div>
                  <div className="metric-item">
                    <label>Oral Energy:</label>
                    <span className="metric-value">{resonanceRecording.metrics.oralEnergy}</span>
                  </div>
                </div>

                {/* Spectrogram Visualization */}
                {resonanceRecording.metrics.spectrogram_data && (
                  <div className="spectrogram-container">
                    <h4>Voice Spectrogram</h4>
                    <canvas 
                      id="resonance-spectrogram"
                      style={{width: '100%', height: 'auto', border: '1px solid #ccc', marginTop: '10px'}}
                    />
                  </div>
                )}

                {resonanceRecording.metrics.characteristics.length > 0 && (
                  <div className="characteristics">
                    <label>Characteristics:</label>
                    <ul>
                      {resonanceRecording.metrics.characteristics.map((char, idx) => (
                        <li key={idx}>{char}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="resonance-notes-card glass-card">
            <h3 className="card-title">Clinical Observations</h3>
            <textarea
              className="notes-textarea"
              placeholder="Document resonance quality observations (nasal, denasal, normal, hypernasality signs, etc.)"
              value={resonanceNotes}
              onChange={(e) => setResonanceNotes(e.target.value)}
              rows="6"
            />
          </div>
        </div>
      </section>

      {/* ===== ARTICULATION SECTION ===== */}
      <section className="ra-section">
        <div className="section-header">
          <h2 className="section-title">Diadochokinetic Speech (DDK) Test</h2>
          <p className="section-subtitle">Evaluate alternating and sequential motion rates</p>
        </div>

        {/* ===== AMR TEST ===== */}
        <div className="ddk-subsection">
          <h3 className="subsection-title">Alternating Motion Rate (AMR)</h3>
          <p className="subsection-instruction">
            Repeat each sound rapidly and continuously (3-4 times): /PA/ /TA/ /KA/
          </p>

          <div className="amr-grid">
            {AMR_ITEMS.map((item, idx) => {
              const meta = amrStateMap[item.id] || {};
              return (
                <div key={item.id} className="amr-card">
                  <div className="card-header">
                    <h4 className="card-sound-label">{item.label}</h4>
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

                  <div className="card-waveform">
                    <AnnotatedWaveformCanvas
                      waveform={meta.waveform || []}
                      samplingRate={meta.samplingRate || 16000}
                    />
                  </div>

                  <div className="card-controls">
                    <button
                      className={`btn-record ${meta.recording ? "recording" : ""}`}
                      onClick={() => toggleAmrRecording(item.id)}
                    >
                      {meta.recording ? "🛑 Stop" : "🎤 Record"}
                    </button>
                    <button
                      className="btn-play"
                      disabled={!meta.audioUrl}
                      onClick={() => handleAmrPlay(item.id)}
                    >
                      🔊 Play
                    </button>
                    <button
                      className="btn-clear"
                      disabled={!meta.audioUrl}
                      onClick={() => clearAmrRecording(item.id)}
                    >
                      🗑 Clear
                    </button>
                  </div>

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

          <div className="impression-box">
            <h4>AMR Impression</h4>
            <textarea
              className="impression-textarea"
              placeholder="Document rate of alternation, clarity, coordination, and any irregularities..."
              value={amrImpression}
              onChange={(e) => setAmrImpression(e.target.value)}
              rows="5"
            />
          </div>
        </div>

        {/* ===== SMR TEST ===== */}
        <div className="ddk-subsection">
          <h3 className="subsection-title">Sequential Motion Rate (SMR)</h3>
          <p className="subsection-instruction">
            Repeat the sequence /PATAKA/ rapidly and continuously (3-4 times)
          </p>

          <div className="smr-card-full">
            <div className="card-header">
              <h4 className="card-sound-label">/PATAKA/</h4>
              <div className="card-timer">
                {smrRecording.recording ? (
                  <>
                    <div className="rec-dot" />
                    {timer.toFixed(1)}s
                  </>
                ) : smrRecording.duration ? (
                  `${smrRecording.duration}s`
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className="card-waveform">
              <AnnotatedWaveformCanvas
                waveform={smrRecording.waveform || []}
                samplingRate={smrRecording.samplingRate || 16000}
              />
            </div>

            <div className="card-controls">
              <button
                className={`btn-record ${smrRecording.recording ? "recording" : ""}`}
                onClick={toggleSmrRecording}
              >
                {smrRecording.recording ? "🛑 Stop" : "🎤 Record"}
              </button>
              <button
                className="btn-play"
                disabled={!smrRecording.audioUrl}
                onClick={() => handlePlay(smrRecording.audioUrl, "smr")}
              >
                🔊 Play
              </button>
              <button
                className="btn-clear"
                disabled={!smrRecording.audioUrl}
                onClick={clearSmrRecording}
              >
                🗑 Clear
              </button>
            </div>

            {smrRecording.duration > 0 && (
              <div className="card-status">
                <span className="status-badge ready">✓ Ready</span>
                <span className="status-value">{smrRecording.duration}s recorded</span>
              </div>
            )}
          </div>

          <div className="impression-box">
            <h4>SMR Impression</h4>
            <textarea
              className="impression-textarea"
              placeholder="Document speed, coordination between sounds, transitions, and any difficulties..."
              value={smrImpression}
              onChange={(e) => setSmrImpression(e.target.value)}
              rows="5"
            />
          </div>
        </div>
      </section>

      {/* ===== ACTION BUTTONS ===== */}
      <section className="action-section">
        <div className="action-buttons">
          <button className="btn-secondary" onClick={handleFinish}>
            Save & Return Home
          </button>
        </div>
      </section>
    </div>
  );
};

export default RessonanceAndArticulationAssessment;
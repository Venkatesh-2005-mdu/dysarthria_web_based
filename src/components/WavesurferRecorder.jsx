import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.js";
import "./WavesurferRecorder.css";

/**
 * WavesurferRecorder Component
 * Records audio from microphone and displays real-time waveform using wavesurfer.js
 * Supports start/stop/pause recording with automatic waveform visualization
 */
const WavesurferRecorder = forwardRef(({
  onRecordingComplete = null,
  onError = null,
  autoGainControl = true,
  echoCancellation = true,
}, ref) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const recordRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState(null);
  const [micLevel, setMicLevel] = useState(0);

  const timerIntervalRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationIdRef = useRef(null);

  const [isReady, setIsReady] = useState(false);

  // Initialize wavesurfer with recording plugin
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    const initializeRecorder = async () => {
      try {
        console.log("Initializing WaveSurfer...");
        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "#2178dc",
          progressColor: "#ef4444",
          cursorColor: "#ef4444",
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 100,
          hideScrollbar: true,
          normalize: true,
          interact: false,
          audioRate: 16000,
        });

        wavesurferRef.current = ws;
        console.log("WaveSurfer created successfully");

        // Wait a bit for WaveSurfer to fully initialize before adding plugin
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!isMounted) return;

        console.log("Registering RecordPlugin...");
        const recordPlugin = ws.registerPlugin(RecordPlugin.create());
        recordRef.current = recordPlugin;
        console.log("RecordPlugin registered successfully");

        // Setup event handlers
        recordPlugin.on("record-start", () => {
          console.log("Recording started");
          if (isMounted) {
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);
            setRecordedBlob(null);
            setError(null);

            timerIntervalRef.current = setInterval(() => {
              setRecordingTime((prev) => prev + 1);
            }, 1000);
          }
        });

        recordPlugin.on("record-pause", () => {
          console.log("Recording paused");
          if (isMounted) setIsPaused(true);
        });

        recordPlugin.on("record-resume", () => {
          console.log("Recording resumed");
          if (isMounted) setIsPaused(false);
        });

        recordPlugin.on("record-stop", (blob) => {
          console.log("Recording stopped, blob size:", blob.size);
          if (isMounted) {
            setIsRecording(false);
            setIsPaused(false);
            setRecordedBlob(blob);

            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }

            if (onRecordingComplete) {
              onRecordingComplete(blob);
            }
          }
        });

        recordPlugin.on("record-data-available", (data) => {
          console.log("Recording data available:", data);
        });

        if (isMounted) {
          setIsReady(true);
          setError(null);
          console.log("Recorder is ready!");
        }
      } catch (err) {
        console.error("Error initializing recorder:", err);
        if (isMounted) {
          const errorMsg = `Initialization error: ${err.message}`;
          setError(errorMsg);
          setIsReady(false);
          if (onError) onError(errorMsg);
        }
      }
    };

    initializeRecorder();

    return () => {
      isMounted = false;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [onRecordingComplete, onError]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getRecordedBlob: () => recordedBlob,
    resetRecorder: () => resetRecorder(),
  }));

  // Start recording from microphone
  const startRecording = async () => {
    try {
      setError(null);

      if (!recordRef.current) {
        const msg = "Recorder not ready yet. Please wait a moment and try again.";
        console.error(msg);
        setError(msg);
        if (onError) onError(msg);
        return;
      }

      console.log("Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl,
          echoCancellation,
          noiseSuppression: true,
        },
      });

      console.log("Microphone access granted");
      mediaStreamRef.current = stream;

      // Set up audio level monitoring
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048;
        source.connect(analyserRef.current);

        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        const monitorLevel = () => {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const average =
            dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
          setMicLevel(average);
          animationIdRef.current = requestAnimationFrame(monitorLevel);
        };
        monitorLevel();
      } catch (audioErr) {
        console.warn("Audio level monitoring not available:", audioErr);
      }

      // Start recording
      console.log("Starting recording with stream...");
      await recordRef.current.startRecording(stream);
      console.log("Recording started successfully");
    } catch (err) {
      console.error("Error in startRecording:", err);
      const errorMsg = err.name === "NotAllowedError"
        ? "Microphone access denied. Please allow microphone access in browser permissions."
        : `Error accessing microphone: ${err.message}`;
      setError(errorMsg);

      if (onError) {
        onError(errorMsg);
      }
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      if (recordRef.current) {
        await recordRef.current.stopRecording();
      }

      // Clean up audio resources
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      setMicLevel(0);
    } catch (err) {
      console.error("Error stopping recording:", err);
      setError(`Error stopping recording: ${err.message}`);
    }
  };

  // Pause recording
  const pauseRecording = async () => {
    try {
      if (recordRef.current && isRecording && !isPaused) {
        await recordRef.current.pauseRecording();
      }
    } catch (err) {
      console.error("Error pausing recording:", err);
      setError(`Error pausing recording: ${err.message}`);
    }
  };

  // Resume recording
  const resumeRecording = async () => {
    try {
      if (recordRef.current && isRecording && isPaused) {
        await recordRef.current.resumeRecording();
      }
    } catch (err) {
      console.error("Error resuming recording:", err);
      setError(`Error resuming recording: ${err.message}`);
    }
  };

  // Reset recorder
  const resetRecorder = () => {
    stopRecording();
    setRecordedBlob(null);
    setRecordingTime(0);
    setError(null);
    setMicLevel(0);
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="wavesurfer-recorder">
      {!isReady && (
        <div className="initializing-message">
          <p>⏳ Initializing audio recorder...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="recorder-header">
        <h3>Real-time Waveform Recorder</h3>
        <div className="recording-info">
          {isRecording && (
            <>
              <span className="recording-badge">● RECORDING</span>
              <span className="timer">{formatTime(recordingTime)}</span>
            </>
          )}
          {recordedBlob && !isRecording && (
            <span className="recorded-badge">✓ Recorded: {formatTime(recordingTime)}</span>
          )}
        </div>
      </div>

      {/* Waveform display container */}
      <div className="waveform-container">
        <div ref={containerRef} className="wavesurfer-display" />
      </div>

      {/* Microphone level indicator */}
      {isRecording && (
        <div className="mic-level-container">
          <label>Microphone Level</label>
          <div className="mic-level-bar">
            <div
              className="mic-level-fill"
              style={{
                width: `${Math.min(100, (micLevel / 128) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div className="recorder-controls">
        {!isRecording ? (
          <button
            className="btn btn-primary"
            onClick={startRecording}
            disabled={!isReady || (recordedBlob && !error)}
          >
            Start Recording
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button className="btn btn-warning" onClick={pauseRecording}>
                Pause
              </button>
            ) : (
              <button className="btn btn-warning" onClick={resumeRecording}>
                Resume
              </button>
            )}
            <button className="btn btn-danger" onClick={stopRecording}>
              Stop
            </button>
          </>
        )}

        {recordedBlob && (
          <button className="btn btn-secondary" onClick={resetRecorder}>
            Reset
          </button>
        )}
      </div>

      {/* Playback section */}
      {recordedBlob && (
        <div className="playback-section">
          <h4>Playback</h4>
          <audio
            controls
            className="audio-player"
            src={URL.createObjectURL(recordedBlob)}
          />
          <div className="blob-info">
            <p>
              <strong>File Size:</strong> {(recordedBlob.size / 1024).toFixed(2)} KB
            </p>
            <p>
              <strong>Type:</strong> {recordedBlob.type || "audio/webm"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
    </div>
  );
});

WavesurferRecorder.displayName = "WavesurferRecorder";

export default WavesurferRecorder;

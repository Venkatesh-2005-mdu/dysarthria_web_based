import { useState, useRef } from 'react';
import './WavesurferRecorder.css';

const WavesurferRecorder = ({
  onRecordingComplete,
  maxDuration = 30,
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTime, setRecordedTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: 'audio/wav',
        });
        onRecordingComplete?.(blob);
        stopRecording();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordedTime((prev) => {
          if (prev >= maxDuration) {
            mediaRecorder.stop();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    stopRecording();
    chunksRef.current = [];
    setRecordedTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div className={`wavesurfer-recorder ${className}`}>
      {isRecording ? (
        <div className="recording-active">
          <div className="recording-indicator">
            <span className="recording-dot" />
            Recording...
          </div>
          <div className="timer">{formatTime(recordedTime)}</div>
          <div className="button-group">
            <button
              className="btn-stop"
              onClick={stopRecording}
            >
              Stop
            </button>
            <button
              className="btn-cancel"
              onClick={cancelRecording}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-record"
          onClick={startRecording}
        >
          🎤 Start Recording
        </button>
      )}
      {maxDuration && (
        <div className="max-duration-info">
          Max duration: {formatTime(maxDuration)}
        </div>
      )}
    </div>
  );
};

export default WavesurferRecorder;

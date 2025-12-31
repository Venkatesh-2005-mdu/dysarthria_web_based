import React, { useState, useRef } from 'react';
import './AudioRecording.css';

export default function AudioRecording({ onRecordingComplete, title = 'Record Audio', instructions = '' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setError('Failed to access microphone: ' + error.message);
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const deleteRecording = () => {
    setRecordedAudio(null);
    setRecordingTime(0);
  };

  const submitRecording = () => {
    if (recordedAudio && onRecordingComplete) {
      onRecordingComplete(recordedAudio, recordingTime);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recording-container">
      <div className="recording-header">
        <h2>{title}</h2>
        {instructions && <p className="instructions">{instructions}</p>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="recording-controls">
        {!isRecording && !recordedAudio && (
          <button onClick={startRecording} className="btn-record">
            🎤 Start Recording
          </button>
        )}

        {isRecording && (
          <div className="recording-active">
            <div className="timer">⏱️ {formatTime(recordingTime)}</div>
            <button onClick={stopRecording} className="btn-stop">
              ⏹️ Stop Recording
            </button>
          </div>
        )}
      </div>

      {recordedAudio && (
        <div className="recording-playback">
          <div className="playback-header">
            <h3>Recording Complete</h3>
            <p className="duration">Duration: {formatTime(recordingTime)}</p>
          </div>
          <audio controls src={URL.createObjectURL(recordedAudio)} className="audio-player" />
          <div className="playback-actions">
            <button onClick={deleteRecording} className="btn-delete">
              🗑️ Delete
            </button>
            <button onClick={submitRecording} className="btn-submit">
              ✓ Use This Recording
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

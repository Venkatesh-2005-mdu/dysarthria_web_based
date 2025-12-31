import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './PhonationAssessment.css';

export default function PhonationAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const submitAnalysis = async () => {
    if (!audioBlob) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'phonation.wav');

      const response = await fetch('http://localhost:8000/phonation/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.phonation_metrics || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="phonation-assessment">
      <div className="assessment-header">
        <h2>Phonation Assessment</h2>
        <p>Sustain a steady /aaa/ sound for as long as you can</p>
      </div>

      <div className="assessment-instructions">
        <ul>
          <li>Take a deep breath</li>
          <li>Say a clear, steady "aaaa" sound</li>
          <li>Maintain a consistent pitch and loudness</li>
          <li>Hold the sound for as long as comfortable</li>
        </ul>
      </div>

      <div className="recording-section">
        {!isRecording && !audioBlob && (
          <button onClick={startRecording} className="btn-large btn-primary">
            🎤 Start Recording
          </button>
        )}

        {isRecording && (
          <div className="recording-active">
            <div className="timer">{formatTime(recordingTime)}</div>
            <button onClick={stopRecording} className="btn-large btn-danger">
              ⏹️ Stop Recording
            </button>
          </div>
        )}

        {audioBlob && (
          <div className="playback-section">
            <h3>Recording Complete</h3>
            <p className="duration">Duration: {formatTime(recordingTime)}</p>
            <audio controls src={URL.createObjectURL(audioBlob)} className="audio-player" />
            <div className="button-group">
              <button onClick={() => setAudioBlob(null)} className="btn-secondary">
                🔄 Re-record
              </button>
              <button onClick={submitAnalysis} disabled={loading} className="btn-primary">
                {loading ? '⏳ Analyzing...' : '✓ Analyze'}
              </button>
            </div>
          </div>
        )}
      </div>

      {results && (
        <div className="results-section">
          <h3>Phonation Results</h3>
          <div className="results-grid">
            <div className="result-card">
              <label>Mean Fundamental Frequency</label>
              <value>{results.fundamental_frequency?.mean_f0?.toFixed(1)} Hz</value>
            </div>
            <div className="result-card">
              <label>Jitter</label>
              <value>{results.jitter_percent?.toFixed(2)}%</value>
            </div>
            <div className="result-card">
              <label>Shimmer</label>
              <value>{results.shimmer_db?.toFixed(2)} dB</value>
            </div>
            <div className="result-card">
              <label>Duration</label>
              <value>{results.duration_seconds?.toFixed(2)}s</value>
            </div>
          </div>
          <div className="interpretation">
            <h4>Interpretation</h4>
            <p>Voice quality metrics have been analyzed. Lower jitter and shimmer values indicate better voice stability.</p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './VoiceTestAssessment.css';

export default function VoiceTestAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [voiceQualityRating, setVoiceQualityRating] = useState('normal');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const submitAnalysis = async () => {
    if (!audioBlob) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-test.wav');

      const response = await fetch('http://localhost:8000/analyze/general', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults({
        ...data.audio_analysis,
        voice_quality: voiceQualityRating,
      });
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voice-test-assessment">
      <div className="assessment-header">
        <h2>Voice Test Assessment</h2>
        <p>Record your voice and describe how you're feeling today</p>
      </div>

      <div className="assessment-instructions">
        <h3>Instructions:</h3>
        <ul>
          <li>Speak naturally about your day or any topic</li>
          <li>Record for 20-30 seconds</li>
          <li>Rate your voice quality after recording</li>
          <li>Assess for breathiness, hoarseness, and strain</li>
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
            <div className="pulse">Recording...</div>
            <button onClick={stopRecording} className="btn-large btn-danger">
              ⏹️ Stop
            </button>
          </div>
        )}

        {audioBlob && (
          <div className="playback-section">
            <audio controls src={URL.createObjectURL(audioBlob)} className="audio-player" />
            <div className="form-group">
              <label>Voice Quality Rating</label>
              <select value={voiceQualityRating} onChange={(e) => setVoiceQualityRating(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="mild">Mild Hoarseness</option>
                <option value="moderate">Moderate Hoarseness</option>
                <option value="severe">Severe Hoarseness</option>
                <option value="breathy">Breathy</option>
                <option value="strained">Strained</option>
              </select>
            </div>
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
          <h3>Voice Test Results</h3>
          <div className="results-grid">
            <div className="result-card">
              <label>Voice Quality</label>
              <value className="capitalize">{results.voice_quality}</value>
            </div>
            <div className="result-card">
              <label>Duration</label>
              <value>{results.duration_seconds?.toFixed(2)}s</value>
            </div>
            <div className="result-card">
              <label>RMS Energy</label>
              <value>{results.rms_energy?.toFixed(3)}</value>
            </div>
            <div className="result-card">
              <label>Peak Amplitude</label>
              <value>{results.peak_amplitude?.toFixed(3)}</value>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

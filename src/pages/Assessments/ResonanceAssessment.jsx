import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function ResonanceAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
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
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const submitAnalysis = async () => {
    if (!audioBlob) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'resonance.wav');

      const response = await fetch('http://localhost:8000/resonance/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.resonance_analysis || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">
      <h2>Resonance Analysis Assessment</h2>
      <p>Say sustained nasal sounds: /mmmm/, /nnnnn/, /nnngg/</p>

      <div className="recording-controls">
        {!isRecording ? (
          <button onClick={startRecording} className="btn-primary">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="btn-danger">
            Stop Recording
          </button>
        )}
      </div>

      {audioBlob && (
        <div className="audio-playback">
          <audio controls src={URL.createObjectURL(audioBlob)} />
          <button onClick={submitAnalysis} disabled={loading} className="btn-primary">
            {loading ? 'Analyzing...' : 'Analyze Resonance'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Resonance Results</h3>
          <div className="metrics">
            <p><strong>Nasality Level:</strong> {results.nasality_level}</p>
            <p><strong>Nasal Resonance Ratio:</strong> {results.nasal_resonance_ratio?.toFixed(2)}</p>
            <p><strong>Spectral Centroid:</strong> {results.spectral_centroid_hz?.toFixed(1)} Hz</p>
          </div>
        </div>
      )}
    </div>
  );
}

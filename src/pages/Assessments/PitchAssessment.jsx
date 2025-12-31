import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function PitchAssessment() {
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
      formData.append('file', audioBlob, 'pitch.wav');

      const response = await fetch('http://localhost:8000/pitch/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.pitch_analysis || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">
      <h2>Pitch Analysis Assessment</h2>
      <p>Say "ahhhh" at your normal speaking pitch, then try low and high pitches</p>

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
            {loading ? 'Analyzing...' : 'Analyze Pitch'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Pitch Analysis Results</h3>
          <div className="metrics">
            <p><strong>Mean Frequency:</strong> {results.mean_frequency_hz?.toFixed(1)} Hz</p>
            <p><strong>Mean Note:</strong> {results.mean_note}</p>
            <p><strong>Pitch Range:</strong> {results.pitch_range_semitones?.toFixed(1)} semitones</p>
            <p><strong>Min Frequency:</strong> {results.min_frequency_hz?.toFixed(1)} Hz ({results.min_note})</p>
            <p><strong>Max Frequency:</strong> {results.max_frequency_hz?.toFixed(1)} Hz ({results.max_note})</p>
            <p><strong>Std Deviation:</strong> {results.std_frequency_hz?.toFixed(1)} Hz</p>
            <p><strong>Vibrato Depth:</strong> {results.vibrato_depth_hz?.toFixed(2)} Hz</p>
            <p><strong>Voiced Proportion:</strong> {(results.voiced_proportion * 100)?.toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function PhonatioAssessment() {
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

  return (
    <div className="assessment-container">
      <h2>Phonation Assessment</h2>
      <p>Sustain a steady /aaa/ sound for as long as you can.</p>

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
            {loading ? 'Analyzing...' : 'Analyze Audio'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Results</h3>
          <div className="metrics">
            <p><strong>Mean F0:</strong> {results.fundamental_frequency?.mean_f0?.toFixed(1)} Hz</p>
            <p><strong>Jitter:</strong> {results.jitter_percent?.toFixed(2)}%</p>
            <p><strong>Shimmer:</strong> {results.shimmer_db?.toFixed(2)} dB</p>
            <p><strong>Duration:</strong> {results.duration_seconds?.toFixed(2)} seconds</p>
          </div>
        </div>
      )}
    </div>
  );
}

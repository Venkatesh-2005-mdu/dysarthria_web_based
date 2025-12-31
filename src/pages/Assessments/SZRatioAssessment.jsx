import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function SZRatioAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fricativeType, setFricativeType] = useState('S');
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
      formData.append('file', audioBlob, 'sz-ratio.wav');

      const response = await fetch('http://localhost:8000/sz-ratio/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.sz_ratio_analysis || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">
      <h2>S/Z Ratio Assessment</h2>
      <p>Hold /s/ sound then /z/ sound for as long as you can</p>

      <div className="form-group">
        <label>Fricative Type:</label>
        <select value={fricativeType} onChange={(e) => setFricativeType(e.target.value)}>
          <option value="all">Both S and Z</option>
          <option value="S">Only /s/</option>
          <option value="Z">Only /z/</option>
        </select>
      </div>

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
            {loading ? 'Analyzing...' : 'Analyze S/Z Ratio'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>S/Z Ratio Results</h3>
          <div className="metrics">
            <p><strong>S Duration:</strong> {results.s_fricative_duration_seconds?.toFixed(2)}s</p>
            <p><strong>Z Duration:</strong> {results.z_fricative_duration_seconds?.toFixed(2)}s</p>
            <p><strong>S/Z Ratio:</strong> {results.sz_ratio?.toFixed(2)}</p>
            <p><strong>Total Fricative Duration:</strong> {results.total_fricative_duration_seconds?.toFixed(2)}s</p>
          </div>
        </div>
      )}
    </div>
  );
}

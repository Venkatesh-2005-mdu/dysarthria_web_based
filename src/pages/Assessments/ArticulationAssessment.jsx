import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function ArticulationAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetUtterance, setTargetUtterance] = useState('');
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
      formData.append('file', audioBlob, 'articulation.wav');
      formData.append('target_utterance', targetUtterance);

      const response = await fetch('http://localhost:8000/articulation/screen', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.articulation_assessment || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">
      <h2>Articulation Screener Assessment</h2>
      <p>Repeat these words clearly: pup, top, cap, papa, tata, kaka</p>

      <div className="form-group">
        <label>Target Utterance:</label>
        <textarea
          value={targetUtterance}
          onChange={(e) => setTargetUtterance(e.target.value)}
          placeholder="Type the words or sentences to be tested..."
          rows="3"
        />
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
            {loading ? 'Analyzing...' : 'Analyze Articulation'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Articulation Results</h3>
          <div className="metrics">
            <p><strong>Consonant Clarity:</strong> {results.consonant_clarity_score?.toFixed(1)}</p>
            <p><strong>Vowel Quality:</strong> {results.vowel_quality_score?.toFixed(1)}</p>
            <p><strong>Overall Score:</strong> {results.overall_articulation_score?.toFixed(1)}</p>
            <p><strong>Articulation Index:</strong> {results.articulation_index?.toFixed(1)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

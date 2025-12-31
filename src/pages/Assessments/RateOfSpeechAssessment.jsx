import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

export default function RateOfSpeechAssessment() {
  const { patientId } = useParams();
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
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
      formData.append('file', audioBlob, 'ros.wav');
      formData.append('transcribed_text', transcription);

      const response = await fetch('http://localhost:8000/rate-of-speech/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data.rate_of_speech || data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">
      <h2>Rate of Speech Assessment</h2>
      <p>Read the provided text at your normal speaking rate.</p>

      <div className="transcription-area">
        <label>Transcribe the spoken text:</label>
        <textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Type what was spoken..."
          rows="5"
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
            {loading ? 'Analyzing...' : 'Analyze Speech Rate'}
          </button>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Rate of Speech Results</h3>
          <div className="metrics">
            <p><strong>Words Per Minute:</strong> {results.words_per_minute?.toFixed(1)}</p>
            <p><strong>Articulation Rate:</strong> {results.articulation_rate_wps?.toFixed(2)} words/sec</p>
            <p><strong>Syllable Rate:</strong> {results.syllable_rate_sps?.toFixed(2)} syllables/sec</p>
            <p><strong>Word Count:</strong> {results.word_count}</p>
            <p><strong>Total Duration:</strong> {results.total_duration_seconds?.toFixed(2)} sec</p>
            <p><strong>Speech Duration:</strong> {results.speech_duration_seconds?.toFixed(2)} sec</p>
          </div>
        </div>
      )}
    </div>
  );
}

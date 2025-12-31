import React, { useState, useEffect } from 'react';
import './ResultsPage.css';
import { useParams, useNavigate } from 'react-router-dom';

export default function ResultsPage() {
  const { assessmentType, sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  const loadResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/assessments/session/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load results');

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getResultsSummary = () => {
    switch (assessmentType) {
      case 'phonation':
        return {
          title: 'Phonation Assessment Results',
          metrics: [
            { label: 'Mean F0 (Hz)', key: 'mean_f0' },
            { label: 'Jitter (%)', key: 'jitter_percent' },
            { label: 'Shimmer (dB)', key: 'shimmer_db' },
            { label: 'Duration (s)', key: 'duration_seconds' },
          ],
          interpretation: 'Voice quality parameters measured successfully.',
        };
      case 'rate-of-speech':
        return {
          title: 'Rate of Speech Results',
          metrics: [
            { label: 'Words Per Minute', key: 'words_per_minute' },
            { label: 'Articulation Rate (WPS)', key: 'articulation_rate_wps' },
            { label: 'Syllable Rate (SPS)', key: 'syllable_rate_sps' },
            { label: 'Total Duration (s)', key: 'total_duration_seconds' },
          ],
          interpretation: 'Speech rate measured successfully.',
        };
      case 'resonance':
        return {
          title: 'Resonance Analysis Results',
          metrics: [
            { label: 'Nasality Level', key: 'nasality_level' },
            { label: 'Nasal Ratio', key: 'nasal_resonance_ratio' },
            { label: 'Spectral Centroid (Hz)', key: 'spectral_centroid_hz' },
          ],
          interpretation: 'Resonance characteristics analyzed.',
        };
      case 'articulation':
        return {
          title: 'Articulation Screener Results',
          metrics: [
            { label: 'Consonant Clarity Score', key: 'consonant_clarity_score' },
            { label: 'Vowel Quality Score', key: 'vowel_quality_score' },
            { label: 'Overall Score', key: 'overall_articulation_score' },
          ],
          interpretation: 'Articulation assessment completed.',
        };
      case 'sz-ratio':
        return {
          title: 'S/Z Ratio Results',
          metrics: [
            { label: 'S Duration (s)', key: 's_fricative_duration_seconds' },
            { label: 'Z Duration (s)', key: 'z_fricative_duration_seconds' },
            { label: 'S/Z Ratio', key: 'sz_ratio' },
          ],
          interpretation: 'Fricative duration measured successfully.',
        };
      case 'pitch':
        return {
          title: 'Pitch Analysis Results',
          metrics: [
            { label: 'Mean Frequency (Hz)', key: 'mean_frequency_hz' },
            { label: 'Pitch Range (Semitones)', key: 'pitch_range_semitones' },
            { label: 'Min Frequency (Hz)', key: 'min_frequency_hz' },
            { label: 'Max Frequency (Hz)', key: 'max_frequency_hz' },
            { label: 'Mean Note', key: 'mean_note' },
          ],
          interpretation: 'Pitch characteristics measured successfully.',
        };
      case 'pataka':
        return {
          title: 'Pataka Test Results',
          metrics: [
            { label: 'Syllable Rate (SPS)', key: 'syllable_rate' },
            { label: 'Mean Interval (ms)', key: 'mean_interval_ms' },
            { label: 'Number of Syllables', key: 'num_syllables' },
            { label: 'Regularity Score', key: 'regularity' },
          ],
          interpretation: 'Rapid syllable repetition measured.',
        };
      default:
        return {
          title: 'Assessment Results',
          metrics: [],
          interpretation: 'Assessment completed.',
        };
    }
  };

  const summary = getResultsSummary();

  if (loading) return <div className="results-container"><p>Loading results...</p></div>;
  if (error) return <div className="results-container error-message">{error}</div>;

  return (
    <div className="results-page">
      <div className="results-header">
        <h1>{summary.title}</h1>
        <p className="session-info">Session ID: {sessionId}</p>
      </div>

      {results && (
        <div className="results-content">
          {/* Metrics Summary */}
          <section className="metrics-section">
            <h2>Measurements</h2>
            <div className="metrics-grid">
              {summary.metrics.map((metric) => (
                <div key={metric.key} className="metric-card">
                  <p className="metric-label">{metric.label}</p>
                  <p className="metric-value">
                    {results[metric.key] !== undefined
                      ? typeof results[metric.key] === 'number'
                        ? results[metric.key].toFixed(2)
                        : results[metric.key]
                      : 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Interpretation */}
          <section className="interpretation-section">
            <h2>Clinical Interpretation</h2>
            <div className="interpretation-content">
              <p>{summary.interpretation}</p>
              <p className="assessment-date">
                <strong>Assessment Date:</strong> {new Date(results.created_at).toLocaleDateString()}
              </p>
            </div>
          </section>

          {/* Raw Data */}
          <section className="raw-data-section">
            <h2>Detailed Data</h2>
            <div className="raw-data">
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          </section>

          {/* Actions */}
          <section className="results-actions">
            <button onClick={() => navigate('/assessments')} className="btn-back">
              Back to Assessments
            </button>
            <button onClick={() => window.print()} className="btn-print">
              Print Results
            </button>
            <button onClick={() => navigate('/reports')} className="btn-report">
              Generate Report
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";

/**
 * Example demonstrating AnnotatedWaveformCanvas usage
 * Shows how to display waveforms with syllable annotations and export capabilities
 */
const AnnotatedWaveformExample = () => {
  // Generate example audio data
  const generateExampleWaveform = () => {
    const sr = 16000;
    const duration = 2; // 2 seconds
    const samples = sr * duration;
    const frequency = 440; // A4 note
    
    const waveform = [];
    for (let i = 0; i < samples; i++) {
      const t = i / sr;
      // Generate a sine wave with envelope
      const envelope = Math.exp(-t * 0.5); // Exponential decay
      const sample = Math.sin(2 * Math.PI * frequency * t) * envelope;
      waveform.push(sample);
    }
    
    return waveform;
  };

  // Example syllable data
  const syllablesData = ["pa", "ta", "ka"];
  const timestampsData = [0.3, 0.8, 1.3];

  const [waveform] = useState(() => generateExampleWaveform());
  const [samplingRate] = useState(16000);

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>AnnotatedWaveformCanvas Example</h1>
      
      <section style={{ marginBottom: "40px" }}>
        <h2>Basic Waveform Display</h2>
        <p>Raw bipolar waveform visualization with time axis labels</p>
        <AnnotatedWaveformCanvas
          waveform={waveform}
          samplingRate={samplingRate}
        />
      </section>

      <section style={{ marginBottom: "40px" }}>
        <h2>Waveform with Syllable Annotations</h2>
        <p>Waveform with vertical markers and syllable labels</p>
        <AnnotatedWaveformCanvas
          waveform={waveform}
          samplingRate={samplingRate}
          syllablesData={syllablesData}
          timestampsData={timestampsData}
        />
      </section>

      <section style={{ marginBottom: "40px" }}>
        <h2>With Export Buttons</h2>
        <p>Waveform with export to Base64 PNG functionality</p>
        <AnnotatedWaveformCanvas
          waveform={waveform}
          samplingRate={samplingRate}
          syllablesData={syllablesData}
          timestampsData={timestampsData}
          showExportButtons={true}
        />
      </section>

      <section style={{ marginBackground: "40px" }}>
        <h2>Usage Details</h2>
        <pre style={{
          backgroundColor: "#f5f5f5",
          padding: "15px",
          borderRadius: "8px",
          overflow: "auto"
        }}>
{`import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";

<AnnotatedWaveformCanvas
  waveform={audioSamples}           // Array of float audio samples
  samplingRate={16000}               // Sampling rate in Hz
  syllablesData={["pa", "ta", "ka"]} // Optional: syllable labels
  timestampsData={[0.3, 0.8, 1.3]}   // Optional: syllable timestamps in seconds
  showExportButtons={false}           // Optional: show export buttons (default: false)
/>
`}
        </pre>
      </section>
    </div>
  );
};

export default AnnotatedWaveformExample;

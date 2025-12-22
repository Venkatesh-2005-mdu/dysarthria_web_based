# Resonance Assessment System - Architecture & Data Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SLP ASSESSMENT PLATFORM                       │
│                    (React Frontend - Port 5173)                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ (WebM Audio Blob)
                              │
                    ┌─────────▼──────────┐
                    │  RessonanceAnd     │
                    │  Articulation      │
                    │  Assessment.jsx    │
                    └────────┬───────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
        ┌─────────▼─────────┐  ┌────────▼────────┐
        │  Waveform Canvas  │  │ Spectrogram     │
        │  (Real-time)      │  │ Viewer          │
        └───────────────────┘  └────────┬────────┘
                                        │
                              ┌─────────▼─────────────┐
                              │   Plotly.js Heatmap   │
                              │   • A1 Peak (Red)     │
                              │   • P0 Peak (Green)   │
                              │   • 0-5000 Hz Range   │
                              └───────────────────────┘
                              
                              ▼ (HTTP POST /api/analyze/resonance/analyze)

┌─────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND                               │
│                       (Port 8000)                                   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │           resonance_analysis.py (Routes)                   │   │
│  │                                                             │   │
│  │  1. Receive WebM blob & validate                          │   │
│  │  2. Save to uploads/resonance/                            │   │
│  │  3. Load with librosa (auto-format detection)             │   │
│  │  4. Resample to 44100 Hz                                  │   │
│  │  5. Trim silence (top_db=30)                              │   │
│  │  6. Validate minimum 2 seconds                            │   │
│  │  7. Call resonance_utils pipeline                         │   │
│  │  8. Generate response JSON                                │   │
│  └───────────────┬────────────────────────────────────────────┘   │
│                  │                                                 │
│                  ▼                                                 │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         resonance_utils.py (Signal Processing)             │   │
│  │                                                             │   │
│  │  Step 1: PRE-EMPHASIS FILTERING                            │   │
│  │  ├─ Formula: y(n) = x(n) - 0.97 * x(n-1)                  │   │
│  │  └─ Purpose: Counteract 6 dB/octave energy drop           │   │
│  │                                                             │   │
│  │  Step 2: FRAME-BASED LPC ANALYSIS                          │   │
│  │  ├─ Frame size: 25 ms (Gaussian window)                   │   │
│  │  ├─ Hop size: 10 ms                                       │   │
│  │  ├─ LPC order: 10-16 (adaptive based on SR)               │   │
│  │  └─ Method: Burg's algorithm                              │   │
│  │                                                             │   │
│  │  Step 3: SPECTRAL CONVERSION                               │   │
│  │  ├─ LPC → Frequency response                              │   │
│  │  ├─ FFT size: 2048                                        │   │
│  │  └─ Output: Magnitude spectrum (dB)                       │   │
│  │                                                             │   │
│  │  Step 4: PEAK EXTRACTION                                   │   │
│  │  ├─ Savitzky-Golay smoothing                              │   │
│  │  ├─ Peak detection with distance constraint               │   │
│  │  └─ Sorted by magnitude (descending)                      │   │
│  │                                                             │   │
│  │  Step 5: METRIC CALCULATION                                │   │
│  │  ├─ A1: First peak (oral resonance)                       │   │
│  │  ├─ P0: Second peak (nasal resonance)                     │   │
│  │  ├─ Difference: A1_dB - P0_dB                             │   │
│  │  └─ Nasality: (Nasal_Energy / (Nasal + Oral)) * 100       │   │
│  │                                                             │   │
│  │  Step 6: CLASSIFICATION                                    │   │
│  │  ├─ Normal: A1-P0 > 10 dB && Nasality < 15%              │   │
│  │  ├─ Hypernasality: A1-P0 < 5 dB && Nasality > 30%        │   │
│  │  ├─ Hyponasality: A1-P0 > 10 dB && Nasality < 5%         │   │
│  │  └─ Mildly Hypernasal: 5 dB < A1-P0 < 8 dB               │   │
│  │                                                             │   │
│  │  Step 7: SPECTROGRAM GENERATION                            │   │
│  │  ├─ STFT with Hamming window                              │   │
│  │  ├─ Convert to dB scale                                   │   │
│  │  └─ Limit to 0-5000 Hz (clinical range)                   │   │
│  │                                                             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  JSON Response     │
                    │  with:             │
                    │  • Metrics         │
                    │  • Spectrogram     │
                    │  • Classification  │
                    │  • Recommendations │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────────────────┐
                    │  Frontend Update State         │
                    │  • Display Spectrogram         │
                    │  • Show Metrics Grid           │
                    │  • Render Classification       │
                    │  • Display Recommendations     │
                    └────────────────────────────────┘
```

## Frequency Band Diagram

```
FREQUENCY SPECTRUM (0-5000 Hz - Clinical Range)
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  NASAL BAND          ORAL BAND                                │
│  (300-700 Hz)        (700-5000 Hz)                            │
│                                                                │
│  ┌─────────┐         ┌──────────────────────────────┐         │
│  │  P0     │         │         A1                   │         │
│  │ (Peak2) │         │       (Peak1)                │         │
│  │         │         │                              │         │
│  │  ~350Hz │         │      ~500-1000 Hz            │         │
│  │  -15dB  │         │      -8 dB                   │         │
│  │         │         │                              │         │
│  │ (Nasal) │         │ (Oral/First Formant)         │         │
│  └─────────┘         └──────────────────────────────┘         │
│  ◊ Green             ● Red                                    │
│    Marker             Marker                                  │
│                                                                │
│  Difference: A1 - P0 = -8 - (-15) = 7.3 dB                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘

ENERGY INTEGRATION:
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Total Nasal Energy (300-700 Hz)                             │
│  ────────────────────────────────────────                      │
│  Total Energy (300-700 Hz + 700-5000 Hz)  × 100 = Nasality% │
│                                                                │
│  Normal:        < 15%  (Oral dominates)                      │
│  Hypernasality: > 30%  (Nasal elevated)                      │
│  Hyponasality:  < 5%   (Nasal suppressed)                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## LPC Analysis Pipeline

```
RAW AUDIO SIGNAL
│
├─ Pre-emphasis Filter
│  └─ y(n) = x(n) - 0.97*x(n-1)
│
├─ Frame Extraction
│  ├─ Frame size: 25 ms
│  ├─ Hop size: 10 ms
│  └─ Window: Gaussian
│
├─ LPC Coefficient Computation (Burg Method)
│  ├─ For each frame, compute LPC coefficients
│  ├─ Order: 10-16 (adaptive)
│  └─ Result: A = [a0, a1, a2, ..., an]
│
├─ Frequency Response Calculation
│  ├─ H(ω) = 1 / A(e^jω)
│  ├─ Magnitude: |H(ω)|
│  └─ Convert to dB: 20*log10(|H(ω)|)
│
├─ Spectral Peak Detection
│  ├─ Smooth spectrum (Savitzky-Golay)
│  ├─ Find peaks with scipy.signal.find_peaks()
│  └─ Sort by magnitude (descending)
│
├─ Peak Identification
│  ├─ Peak 1 (A1): First/highest peak = Oral resonance
│  └─ Peak 2 (P0): Second peak = Nasal resonance
│
├─ Metric Calculation
│  ├─ A1-P0 difference (dB)
│  ├─ Nasality ratio (%)
│  └─ Classification
│
└─ Spectrogram Generation
   ├─ STFT computation
   ├─ Convert to dB
   └─ Limit to clinical range (0-5000 Hz)
```

## Clinical Decision Tree

```
                    AUDIO RECORDING
                          │
                          ▼
            ┌──────────────────────────┐
            │   A1-P0 DIFFERENCE       │
            │   (Primary Metric)       │
            └──────────────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼────┐  ┌──────▼──────┐  ┌──▼───────┐
    │ > 10 dB    │  │ 5-8 dB      │  │ < 5 dB   │
    └────┬───────┘  └──────┬──────┘  └──┬───────┘
         │                 │            │
         │                 │   ┌────────▼───────┐
         │                 │   │  Nasality      │
         │                 │   │  Check         │
         │                 │   └────────┬───────┘
         │                 │            │
         │            ┌────▼─────────┐ ┌┴──────┐
         │            │ Check        │ │Check  │
         │            │ Nasality     │ │       │
         │            └────┬─────────┘ │       │
         │                 │           │       │
         ▼                 ▼           ▼       ▼
    ┌─────────┐    ┌─────────────┐ ┌──────────────────┐
    │ NORMAL  │    │ MILDLY      │ │ HYPERNASALITY    │
    │         │    │ HYPERNASAL  │ │ Nasality > 30%   │
    │A1-P0>10 │    │ OR NORMAL   │ │                  │
    │Nas<15%  │    │ Nas 15-30%  │ │ → VPI Suspect    │
    └─────────┘    └─────────────┘ │ → Palatal defect │
    ✅ No Dev      ⚡ Monitor      └──────────────────┘
    Nasal closed   Borderline      ⚠️  Significant
                                    Follow-up needed
         
    ┌──────────────────────────────┐
    │ HYPONASALITY (High A1-P0)     │
    │ Nasality < 5%                │
    │                              │
    │ → Nasal obstruction          │
    │ → Adenoid hypertrophy        │
    │ → Nasal compensation         │
    └──────────────────────────────┘
    ⚠️  Significant
    Evaluate for nasal blockage
```

## Response JSON Structure

```json
{
  "vowel": "o",
  "sampling_rate": 44100,
  "duration": 3.45,
  
  "a1_frequency": 520,           // Hz - Oral peak
  "a1_magnitude": -8.2,          // dB
  
  "p0_frequency": 380,           // Hz - Nasal peak
  "p0_magnitude": -15.5,         // dB
  
  "a1_p0_difference": 7.3,       // dB - PRIMARY METRIC
  "nasality_ratio": 18.5,        // % - SECONDARY METRIC
  
  "classification": {
    "status": "Mildly Hypernasal",
    "severity": "Mild",
    "recommendation": "Mild elevation in nasal resonance. Monitor for consistency."
  },
  
  "all_peaks": [
    [520, -8.2],                 // Peak 1: Oral
    [380, -15.5],                // Peak 2: Nasal
    [2400, -22.1],               // Peak 3: Additional
    [3200, -25.0]                // Peak 4: Additional
  ],
  
  "spectrum": [
    -40.2, -38.5, -36.9, ..., -50.0  // 2048 frequency bins in dB
  ],
  "spectrum_frequencies": [
    0, 21.5, 43.1, 64.6, ..., 22050  // Hz bins (0 to Nyquist)
  ],
  
  "spectrogram": [
    [-45, -42, -40, ..., -60],  // Frame 1
    [-44, -41, -38, ..., -59],  // Frame 2
    ...                         // More frames
  ],
  "spectrogram_frequencies": [0, 24.4, 48.8, ..., 5000],  // Hz
  "spectrogram_times": [0, 0.025, 0.05, ..., 3.5]         // Seconds
}
```

## UI Component Hierarchy

```
RessonanceAndArticulationAssessment
│
├── Navbar
│   └── Progress indicator (50%)
│
├── Breadcrumb Navigation
│   └── Dashboard > Assessments > Resonance & Articulation
│
├── Instructions Card
│   └── Tips for recording
│
├── Resonance Quality Assessment Section
│   ├── Recording Card
│   │   ├── Waveform Canvas (AnnotatedWaveformCanvas)
│   │   ├── Record/Stop/Play/Clear buttons
│   │   └── Timer
│   │
│   ├── Analysis Results (when complete)
│   │   ├── SpectrogramViewer Component
│   │   │   ├── Plotly Heatmap
│   │   │   │   ├── Red A1 Peak Marker
│   │   │   │   ├── Green P0 Peak Marker
│   │   │   │   └── Frequency/Time Axes
│   │   │   ├── Legend (A1/P0 identification)
│   │   │   └── Info Grid (metrics display)
│   │   │
│   │   ├── Metrics Grid
│   │   │   ├── A1 Frequency
│   │   │   ├── A1 Magnitude
│   │   │   ├── P0 Frequency
│   │   │   ├── P0 Magnitude
│   │   │   ├── A1-P0 Difference
│   │   │   └── Nasality Ratio
│   │   │
│   │   ├── Classification Details
│   │   │   ├── Status Badge
│   │   │   ├── Severity Level
│   │   │   └── Recommendation Text
│   │   │
│   │   └── Detected Peaks List
│   │       └── All spectral peaks with frequencies
│   │
│   └── Clinical Observations Textarea
│
├── Diadochokinetic Speech (DDK) Test Section
│   ├── Alternating Motion Rate (AMR) - /PA/ /TA/ /KA/
│   │   ├── Three separate recording cards
│   │   └── Shared impression textarea
│   │
│   └── Sequential Motion Rate (SMR) - /PATAKA/
│       └── Single recording card + impression textarea
│
└── Action Buttons
    └── Save & Return Home
```

## State Management Flow

```
User Records Audio
        │
        ▼
setResonanceRecording({
  recording: true,
  audioUrl: null,
  blob: null,
  duration: 0,
  waveform: [],
  samplingRate: 44100,
  metrics: null,
  spectrogram: null,
  spectrogramFrequencies: null,
  spectrogramTimes: null,
  analysisInProgress: false
})
        │
        ▼
User clicks Stop
        │
        ▼
analyzeAudioBlob() → {duration, waveform, samplingRate}
        │
        ▼
setResonanceRecording({
  recording: false,
  ...analysisResult
})
        │
        ▼
uploadResonanceToBackend(blob)
        │
        ▼
setResonanceRecording({
  analysisInProgress: true
})
        │
        ▼ [Backend Analysis 2-5 seconds]
        │
        ▼
setResonanceRecording({
  metrics: {
    a1Frequency, a1Magnitude,
    p0Frequency, p0Magnitude,
    a1P0Difference, nasalityRatio,
    classification
  },
  spectrogram: [...],
  spectrogramFrequencies: [...],
  spectrogramTimes: [...],
  analysisInProgress: false
})
        │
        ▼
Display Results
├── Spectrogram with markers
├── Metrics grid
├── Classification badge
└── Recommendations
```

---

This architecture provides a comprehensive, research-backed resonance quality assessment system integrated seamlessly into the SLP Assessment platform.

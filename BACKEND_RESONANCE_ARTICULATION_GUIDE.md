# Backend Processing: Resonance & Articulation Analysis

## Overview

The backend handles advanced signal processing that cannot be done in the browser. It receives audio files from the frontend and performs clinical-grade analysis using Python's scientific computing libraries (librosa, scipy).

---

## 1. RESONANCE ANALYSIS

**Endpoint:** `POST /api/analyze/resonance/analyze`

**Purpose:** Detect nasal vs oral resonance using advanced spectral analysis

### Processing Pipeline

```
Uploaded Audio (WebM blob)
    ↓
1. LOAD & RESAMPLE
   └─ librosa.load() with sr=44100 Hz
   └─ Standardizes to consistent sample rate
   
    ↓
2. TRIM SILENCE
   └─ librosa.effects.trim() with top_db=30
   └─ Removes quiet parts at beginning/end
   └─ Requires minimum 2 seconds of audio
   
    ↓
3. PRE-EMPHASIS FILTERING
   └─ Compensates for 6 dB/octave drop in natural speech
   └─ Formula: y(n) = x(n) - 0.97 * x(n-1)
   └─ Boosts high frequencies
   
    ↓
4. FRAME-BASED ANALYSIS
   └─ Divides audio into 25ms frames with 10ms hop
   └─ Applies Gaussian window to each frame
   └─ Processes first 10 frames (avg ≈ 100ms of audio)
   
    ↓
5. LPC ANALYSIS (Linear Predictive Coding)
   └─ Burg's method with adaptive LPC order
   └─ Order = 10-16 based on sample rate (44.1kHz → order 14)
   └─ Models vocal tract as an all-pole filter
   └─ Converts audio to spectral coefficients
   
    ↓
6. CONVERT TO SPECTRUM
   └─ LPC coefficients → frequency domain (2048-point FFT)
   └─ Magnitude response in dB
   └─ Frequency range: 0-22050 Hz (Nyquist frequency)
   
    ↓
7. AVERAGING ACROSS FRAMES
   └─ Average all 10 frame spectra
   └─ Smooths out frame-to-frame variation
   
    ↓
8. PEAK EXTRACTION
   └─ Savitzky-Golay smoothing (51-point window, order 3)
   └─ scipy.signal.find_peaks() with 20-bin distance
   └─ Extracts top 5 peaks by magnitude
   └─ Returns (frequency_hz, magnitude_db) tuples
   
    ↓
9. IDENTIFY A1 & P0
   ┌─ A1 (Oral resonance / First Formant)
   │  └─ Highest frequency peak from first 2 peaks
   │  └─ Typical range: 500-900 Hz
   │  └─ Represents velar/oral cavity resonance
   │
   └─ P0 (Nasal peak)
      └─ Lower frequency peak (typically <500 Hz)
      └─ Represents nasal cavity resonance
      └─ Only prominent when hypernasality present
   
    ↓
10. CALCULATE METRICS
    ├─ A1 - P0 Difference (dB)
    │  └─ Normal: >5 dB (A1 dominant)
    │  └─ Hypernasality: <5 dB (P0 prominent)
    │
    ├─ Nasality Ratio (%)
    │  └─ Energy in nasal band (300-700 Hz) / Total energy
    │  └─ Normal: 20-30%
    │  └─ Hypernasality: >40%
    │
    └─ Classification
       ├─ Normal Resonance: A1-P0 diff > 5 dB, nasality < 35%
       ├─ Hypernasality: A1-P0 diff < 5 dB, nasality > 35%
       └─ Hyponasality: P0 suppressed, nasal consonants affected

    ↓
11. SPECTROGRAM GENERATION
    └─ STFT (Short-Time Fourier Transform)
    └─ Displays frequency content over time
    └─ Visualizes resonance changes during utterance
    └─ Returns: spectrogram data + frequency axis + time axis
    
    ↓
RESPONSE (JSON)
├─ a1_frequency (Hz)
├─ a1_magnitude (dB)
├─ p0_frequency (Hz)
├─ p0_magnitude (dB)
├─ a1_p0_difference (dB) ← KEY DIAGNOSTIC METRIC
├─ nasality_ratio (%)
├─ classification: {status, confidence}
├─ all_peaks: list of all detected peaks
├─ spectrogram: 2D array for visualization
├─ spectrum_frequencies: X-axis for LPC spectrum plot
├─ spectrogram_times: X-axis for spectrogram plot
└─ spectrogram_frequencies: Y-axis for spectrogram plot
```

### Clinical Interpretation

| Metric | Normal | Hypernasality | Hyponasality |
|--------|--------|---------------|--------------|
| **A1-P0 Diff** | > 5 dB | < 5 dB | N/A (suppressed P0) |
| **Nasality %** | 20-30% | > 40% | < 15% |
| **Perceptual** | Clean oral consonants | Nasal emission on /p, b, t, d, k, g/ | Nasal sounds like oral |

---

## 2. ARTICULATION SCREENER

**Endpoint:** `POST /api/analyze/articulation/screen`

**Purpose:** Score articulation errors using Test of Articulation in Tamil (TAT)

### Analysis Process

**Input:** 
- List of words with manual transcription + audio for each
- Patient age/type (child, adult, elderly)

**Processing:**
```
For each recorded word:
  ├─ 1. RMS Energy Analysis
  │  └─ Detects voice strength/quality
  │  └─ Flags clipped/weak recordings
  │
  ├─ 2. Spectral Analysis
  │  ├─ FFT to frequency domain
  │  ├─ Spectral Centroid: Overall brightness (Hz)
  │  └─ Spectral Bandwidth: Frequency spread
  │
  ├─ 3. Error Type Classification
  │  ├─ S (Substitution): Wrong phoneme produced
  │  ├─ O (Omission): Sound skipped/missing
  │  ├─ D (Distortion): Malformed but recognizable
  │  └─ A (Addition): Extra sound inserted
  │
  └─ 4. Audio Quality Check
     └─ Flags distortion/noise for clinician review
```

**Response:**
```json
{
  "total_words": 48,
  "words_recorded": 45,
  "words_with_errors": 12,
  "error_summary": {
    "S": 7,  // Substitutions
    "O": 3,  // Omissions
    "D": 2,  // Distortions
    "A": 0   // Additions
  },
  "accuracy_percentage": 73.3,
  "severity_level": "mild",
  "detailed_analysis": [...]
}
```

**Severity Scoring:**
- Mild: 70-85% accuracy
- Moderate: 50-70% accuracy
- Severe: <50% accuracy

---

## 3. ALTERNATING MOTION RATE (AMR) - /PA/, /TA/, /KA/

**Endpoint:** `POST /api/analyze/amr?sound={pa|ta|ka}`

**Purpose:** Measure diadochokinetic rate (rapid alternating syllable repetition)

### Analysis

```
Uploaded audio (raw PCM via JSON)
    ↓
1. DURATION CALCULATION
   └─ samples / sample_rate
   └─ Example: 48000 samples ÷ 16000 Hz = 3.0 seconds
   
    ↓
2. WAVEFORM DOWNSAMPLING
   └─ Downsample to 3000 points for visualization
   └─ factor = len(audio) // 3000
   └─ Returns display-friendly waveform
   
    ↓
3. REPETITION COUNT ESTIMATION
   └─ Average 5-7 syllables per second
   └─ Formula: duration * 6 = estimated reps
   └─ Example: 3 sec × 6 = ~18 repetitions
   
    ↓
RESPONSE
├─ sound: "pa" (or "ta", "ka")
├─ test_type: "amr"
├─ duration_sec: 3.0
├─ sampling_rate: 16000
├─ waveform: [0.001, -0.002, ...] (3000 points)
├─ repetition_count: 18
└─ (Clinician validates actual count by listening)
```

**Clinical Significance:**
- Normal AMR: 5-7 syllables/second
- Slow: <5 syllables/second → Motor control issues
- Fast: >8 syllables/second → Tension/spasticity

---

## 4. SEQUENTIAL MOTION RATE (SMR) - PATAKA

**Endpoint:** `POST /api/analyze/smr`

**Purpose:** Measure ability to produce rapid sequence of different sounds

### Analysis

```
Audio sequence: PA-TA-KA-PA-TA-KA...
    ↓
1. Similar to AMR but requires TRANSITIONS
   └─ More demanding test
   └─ Indicates motor planning ability
   
    ↓
2. TRANSITION QUALITY
   └─ Smooth: Good coordination
   └─ Stuttered: Coordination issues
   └─ Reversed: Neurological concern
   
    ↓
RESPONSE
├─ test_type: "smr"
├─ duration_sec: 3.0
├─ waveform: [...]
├─ repetition_count: 18
└─ transition_quality: "normal" | "stuttered" | "reversed"
```

---

## Backend Processing Summary

| Test | Input | Processing | Output |
|------|-------|-----------|--------|
| **Resonance** | WebM audio | LPC spectral analysis | A1/P0 frequencies, nasality %, classification |
| **Articulation** | Word audio + manual scoring | RMS + spectral analysis | Error counts, accuracy %, severity |
| **AMR** | PCM audio | Duration + downsampling | Rep count estimate, waveform |
| **SMR** | PCM audio | Duration + transition check | Rep count, transition quality |

---

## Key Libraries Used

- **librosa**: Audio loading, resampling, trimming, STFT
- **scipy.signal**: LPC, FFT, peak finding, filtering
- **numpy**: Array operations, spectrum calculations
- **FastAPI**: HTTP routing and async handlers

---

## Error Handling

```python
# Frontend sends malformed data
└─ Backend validates: audio length, format, sample rate
└─ Returns 400 error with description

# Audio too short (<2 seconds for resonance)
└─ Returns 400: "Audio too short. Minimum 2 seconds required."

# LibROSA can't decode format
└─ Returns 400: "Audio loading failed: [error message]"

# Internal processing error
└─ Returns 500: "Analysis failed: [traceback]"
```

All backend routes log debug output for troubleshooting.


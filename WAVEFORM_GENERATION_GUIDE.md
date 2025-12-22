# Waveform Generation Flow in PhonationAssessment

## 📊 Yes - It Uses Plotly.js!

**AnnotatedWaveformCanvas.jsx** uses `react-plotly.js` (Plot component) to display the waveform as a real-time interactive chart with Plotly.

---

## 🔄 Complete Waveform Generation Pipeline

### **Phase 1: Recording Audio**

```
User clicks "Start Recording"
     ↓
PhonationAssessment.jsx → startRecording(itemId)
     ↓
Browser requests microphone permission via navigator.mediaDevices.getUserMedia()
     ↓
MediaRecorder captures audio in WebM format
     ↓
Audio chunks collected in chunksRef.current array
     ↓
AnnotatedWaveformCanvas displays LIVE waveform during recording
     ↓
User clicks "Stop Recording"
     ↓
mediaRecorderRef.ondataavailable fires → Blob created from chunks
```

**Files Involved:**
- `PhonationAssessment.jsx` - Main component handling recording logic
- `AnnotatedWaveformCanvas.jsx` - Real-time waveform visualization

---

### **Phase 2: Analyze Audio Locally (Frontend)**

```
Recording stops → analyzeAudioBlob(blob) called
     ↓
Blob converted to ArrayBuffer via blob.arrayBuffer()
     ↓
Web Audio API decodes the ArrayBuffer:
  - AudioContext.decodeAudioData(arrayBuffer)
  - Converts WebM → PCM raw audio data (float32)
     ↓
Extract raw audio samples: decoded.getChannelData(0)
     ↓
Calculate duration: decoded.duration
     ↓
Get sampling rate: decoded.sampleRate (usually 16000 Hz)
     ↓
DOWNSAMPLE for display (max 2000 points):
  - Calculate downsample factor: Math.ceil(data.length / 2000)
  - Sample every nth value: downsampledWaveform = []
     ↓
Return: { duration, waveform[], samplingRate }
```

**Code Location:** [PhonationAssessment.jsx](PhonationAssessment.jsx#L130-L160)

```javascript
const analyzeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  
  // Get raw audio samples
  const data = decoded.getChannelData(0); // Float32Array
  const duration = decoded.duration;      // Seconds
  const sr = decoded.sampleRate;          // Hz (16000)

  // Downsample: max 2000 points
  const maxPoints = 2000;
  const factor = Math.ceil(data.length / maxPoints);
  const downsampled = [];
  
  for (let i = 0; i < data.length; i += factor) {
    downsampled.push(data[i]);
  }

  return {
    duration: parseFloat(duration.toFixed(2)),
    waveform: downsampled,     // Ready for display
    samplingRate: sr,
  };
};
```

---

### **Phase 3: Display Waveform (Plotly.js)**

```
Frontend waveform data (downsampled) stored in stateMap
     ↓
AnnotatedWaveformCanvas receives props:
  - waveform: [ -0.1, 0.05, 0.15, -0.08, ... ]  (amplitude samples)
  - samplingRate: 16000  (Hz)
  - syllablesData: []    (optional annotations)
     ↓
Generate TIME AXIS (seconds):
  timeAxis = waveform.map((_, i) => i / samplingRate)
     ↓
Create Plotly trace object:
  {
    x: [0, 0.0001, 0.0002, ...],  // Time in seconds
    y: [-0.1, 0.05, 0.15, ...],   // Amplitude values
    mode: "lines",
    line: { color: "#2178dc", width: 1.5 }
  }
     ↓
Render with Plotly layout:
  - X-axis: "Time (s)"
  - Y-axis: "Amplitude" (range: -1.2 to 1.2)
  - Grid: enabled for readability
  - Hover: shows "Time: X s, Amplitude: Y"
     ↓
Display as interactive chart using <Plot /> component
```

**Code Location:** [AnnotatedWaveformCanvas.jsx](AnnotatedWaveformCanvas.jsx#L35-L75)

```jsx
const timeAxis = useMemo(() => {
  if (displayWaveform.length === 0) return [];
  return displayWaveform.map((_, i) => ((i * 3) / samplingRate));
  //                                    Note: 3x downsampling for live waveform
}, [displayWaveform, samplingRate]);

const traces = useMemo(() => {
  const mainTrace = {
    x: timeAxis,
    y: displayWaveform,
    mode: "lines",
    name: "Waveform",
    line: {
      color: "#2178dc",
      width: 1.5,
    },
    hovertemplate: "Time: %{x:.3f}s<br>Amplitude: %{y:.4f}<extra></extra>",
  };
  return [mainTrace];
}, [displayWaveform, timeAxis]);

// Render with Plotly
return (
  <Plot
    ref={plotRef}
    data={traces}
    layout={layout}
    config={config}
    style={{ width: "100%", height: "400px" }}
  />
);
```

---

### **Phase 4: Upload to Backend (FastAPI)**

```
Optional: Send to backend for clinical analysis
     ↓
uploadToBackend(itemId, blob) called
     ↓
Blob decoded to PCM float32 array:
  - Get raw audio samples from Web Audio API
  - samplingRate extracted (usually 16000 Hz)
     ↓
Send to backend: POST /phonation/upload/{itemId}
  {
    "vowel": "a",
    "audio_data": [-0.1, 0.05, 0.15, ...],
    "sample_rate": 16000
  }
     ↓
Backend (FastAPI) processes:
  - Converts PCM to WAV using FFmpeg
  - Analyzes audio: pitch, duration, formants
  - Returns clinical metrics + waveform
     ↓
Frontend receives response:
  {
    "duration_sec": 2.5,
    "waveform": [...],           // Backend downsampled
    "sampling_rate": 16000,
    "pitch": 120.5,              // Hz
    "formants": {...}
  }
     ↓
Update stateMap with backend results
```

**Code Location:** [PhonationAssessment.jsx](PhonationAssessment.jsx#L80-L120)

---

## 📁 Files Involved in Waveform Generation

### **Frontend (React)**

| File | Role |
|------|------|
| `PhonationAssessment.jsx` | ✅ **Main orchestrator**: Recording, audio analysis, state management |
| `AnnotatedWaveformCanvas.jsx` | ✅ **Visualization**: Renders waveform using Plotly.js |
| `realtimeAudioCapture.js` | Real-time audio capture utility (optional enhancement) |
| `LevelMeter.jsx` | Shows microphone recording level during capture |

### **Backend (Python FastAPI)**

| File | Role |
|------|------|
| `backend/routes/phonation_test.py` | `POST /phonation/upload/{vowel}` - receives audio and returns analyzed waveform |
| `backend/core/audio_utils.py` | Audio file I/O, waveform extraction |
| `backend/core/phonation_utils.py` | Duration, pitch analysis |
| `backend/core/pitch_utils.py` | F0 (fundamental frequency) calculation |

---

## 🎯 Key Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PhonationAssessment.jsx                       │
│  (Records audio & manages recording state)                       │
└────────────────────────┬──────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   ┌─────────┐  ┌─────────────────┐  ┌──────────┐
   │Recording │  │analyzeAudioBlob │  │Upload to │
   │via       │  │(Web Audio API)  │  │Backend   │
   │MediaRecdr│  │                 │  │          │
   │         │  │ Decode WebM →   │  │ POST     │
   │         │  │ Extract PCM →   │  │ /upload  │
   │         │  │ Downsample →    │  │          │
   │         │  │ max 2000 points │  │          │
   └────┬────┘  └────────┬────────┘  └──────┬───┘
        │                │                  │
        └────────────────┼──────────────────┘
                         │
                         ↓ (waveform array + samplingRate)
              ┌──────────────────────┐
              │ AnnotatedWaveform    │
              │ Canvas.jsx           │
              │                      │
              │ Generate timeAxis    │
              │ Create Plotly traces │
              │ Render <Plot />      │
              │                      │
              │ Chart displayed!     │
              └──────────────────────┘
```

---

## 🔬 Example Data Flow

### **Input (Raw Audio)**
```
MediaRecorder captures WebM:
  [0xFFD8FFEB, 0x000003F0, 0x4A464946, ...] (binary chunks)
```

### **After Web Audio Decoding**
```
PCM Float32Array (16000 Hz sampling rate, 2.5 second recording):
  [-0.0001, 0.0005, -0.0003, 0.0008, ..., 0.0002]
  Length: 16000 * 2.5 = 40,000 samples
```

### **After Downsampling (for display)**
```
Downsample factor: Math.ceil(40000 / 2000) = 20
Downsampled waveform:
  [-0.0001, 0.0012, -0.0025, 0.0018, ..., 0.0002]
  Length: 2000 samples (for smooth display)
```

### **Plotly Chart**
```
X-axis (timeAxis):  [0, 0.00125, 0.0025, ..., 2.5]  (seconds)
Y-axis (amplitude): [-0.0001, 0.0012, -0.0025, ...]
Visualization: Smooth line plot with hover information
```

---

## 📊 Configuration Summary

| Property | Value | Purpose |
|----------|-------|---------|
| **Sampling Rate** | 16,000 Hz | Standard for speech analysis (SLP) |
| **Max Display Points** | 2,000 samples | Smooth visualization without lag |
| **Audio Format** | WebM (recording) | Browser compatibility |
| **Waveform Format** | PCM Float32 | Accurate amplitude representation |
| **Plotly Line Color** | #2178dc (blue) | Visual clarity |
| **Y-axis Range** | -1.2 to 1.2 | Shows full amplitude spectrum |

---

## ✨ Special Features

### **Real-time Waveform (During Recording)**
```
AnnotatedWaveformCanvas has updateLiveWaveform() method:
  - Called on each MediaRecorder dataavailable event
  - Updates liveWaveformRef with 3x downsampled chunks
  - Max 12,000 samples kept in buffer (~0.75s visible)
  - Creates scrolling effect as recording continues
```

### **Plotly.js Interactivity**
- **Hover**: Shows exact time and amplitude
- **Zoom**: Click and drag to zoom into specific time ranges
- **Pan**: Scroll to pan across the waveform
- **Download**: Built-in PNG export button
- **Reset**: Double-click to reset zoom

---

## 🚀 Summary

**Yes, PhonationAssessment uses Plotly.js!**

1. **Records** audio as WebM via MediaRecorder
2. **Analyzes** with Web Audio API (decodes to PCM)
3. **Downsamples** to max 2000 points for display
4. **Visualizes** using Plotly.js in AnnotatedWaveformCanvas
5. **Optionally uploads** to backend for clinical metrics

The waveform is **interactive, responsive, and clinically useful** for speech-language pathology assessments!

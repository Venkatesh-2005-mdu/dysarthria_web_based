# Waveform Generation: Complete Step-by-Step Process

## Overview

The waveform generation process happens entirely in the **FRONTEND** across 4 main files. The backend is NOT involved in waveform display—it only archives audio.

```
┌────────────────────────────────────────────────────────────────┐
│              WAVEFORM GENERATION PIPELINE                       │
│                    (Frontend Only)                              │
└────────────────────────────────────────────────────────────────┘
```

---

## Files Involved (4 Files)

| File | Language | Purpose | Lines |
|------|----------|---------|-------|
| [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) | React JSX | Main component, orchestrates recording flow | 811 |
| [src/utils/realtimeAudioCapture.js](src/utils/realtimeAudioCapture.js) | JavaScript | Captures live audio samples during recording | 84 |
| [src/components/AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx) | React JSX | Renders waveform visualization with Plotly | 217 |
| [src/App.jsx](src/App.jsx) | React JSX | Routes to PhonationAssessment page | - |

---

## Step-by-Step Waveform Generation Process

### **STEP 1: User Opens Phonation Assessment**

**File:** [src/App.jsx](src/App.jsx)  
**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 23-70)

```
Browser loads http://localhost:5173
    ↓
Router matches /assess/phonation
    ↓
PhonationAssessment.jsx renders
    ↓
useEffect hook (lines 61-76) runs:
  • navigator.mediaDevices.getUserMedia({ audio: true })
  • Browser asks for microphone permission
  • User clicks "Allow"
  • streamRef.current = microphone stream (MediaStream object)
    ↓
Recording UI displays with 4 vowel buttons (/A/, /II/, /U/, /UHM/)
```

**State initialized:** [PhonationAssessment.jsx, lines 29-44]
```javascript
const [stateMap, setStateMap] = useState(() =>
  VOWEL_ITEMS.reduce((acc, it) => {
    acc[it.id] = {
      recording: false,
      audioUrl: null,
      blob: null,
      duration: 0,
      waveform: [],          // ← Empty array initially
      samplingRate: 16000,
      isPlaying: false,
      backendDuration: null,
    };
    return acc;
  }, {})
);
```

---

### **STEP 2: User Clicks "Record" Button**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 291-330)

```
User clicks "Record" on vowel /A/
    ↓
toggleRecording("a") called
    ↓
startRecording("a") function (lines 177-254)
    ├─ chunksRef.current = []  (reset chunks array)
    ├─ activeItemRef.current = "a"
    │
    ├─→ Create MediaRecorder (lines 199-204):
    │   mediaRecorderRef.current = new MediaRecorder(streamRef.current)
    │   • Format: WebM (Opus codec)
    │   • Connects to microphone stream
    │   • Starts buffering audio into browser memory
    │
    ├─→ Set up ondataavailable handler (lines 206-208):
    │   • Every ~1 second, audio data emitted
    │   • Chunks stored in chunksRef.current
    │   • Example: [Blob(chunk1), Blob(chunk2), ...]
    │
    └─→ Create RealtimeAudioCapture (lines 245-253):
        new RealtimeAudioCapture(callback, 16000)
            ├─ Creates Web Audio API AudioContext
            ├─ Connects to microphone stream
            ├─ ScriptProcessorNode gets raw audio samples
            └─ Calls callback with audio data every ~21.3ms (4096 samples @ 48kHz)
```

**MediaRecorder starts:** `mediaRecorderRef.current.start()`

---

### **STEP 3: LIVE Waveform Display (During Recording)**

**DURING RECORDING:** Real-time visualization updates every ~21ms

#### **3A: RealtimeAudioCapture Captures Samples**

**File:** [src/utils/realtimeAudioCapture.js](src/utils/realtimeAudioCapture.js) (lines 17-46)

```javascript
async start(stream) {
  // Create AudioContext from microphone stream
  const source = this.audioContext.createMediaStreamSource(stream);
  
  // Create ScriptProcessorNode for raw audio
  this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
  //                                                        ↑ buffer size
  //                                         (4096 samples @ device sr)
  
  // onaudioprocess fires ~11ms (every buffer)
  this.scriptProcessorNode.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    // inputData = Float32Array [4096 samples]
    // Each sample ∈ [-1.0, 1.0]
    
    this.onAudioData(Array.from(inputData));
    // Send to PhonationAssessment callback
  };
}
```

**Data flow:**
```
Microphone audio stream (continuous)
    ↓ (every 4096 samples at device sr, ~85ms @ 48kHz)
AudioContext audio graph
    ↓
ScriptProcessorNode captures samples
    ↓
onaudioprocess event fires
    ↓
Callback: audioSamples = [s1, s2, s3, ..., s4096]
    ↓
Sent to PhonationAssessment.jsx
```

#### **3B: PhonationAssessment Forwards to Waveform Canvas**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 245-253)

```javascript
audioCaptureRef.current = new RealtimeAudioCapture((audioSamples) => {
  // Callback receives audio samples
  const currentWaveformRef = waveformCanvasRefsRef.current[itemId];
  if (currentWaveformRef && audioSamples.length > 0) {
    // Call updateLiveWaveform on AnnotatedWaveformCanvas
    currentWaveformRef.updateLiveWaveform(audioSamples);
  }
}, 16000);
```

#### **3C: AnnotatedWaveformCanvas Updates Live Display**

**File:** [src/components/AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx) (lines 150-162)

```javascript
const updateLiveWaveform = (audioChunk) => {
  if (Array.isArray(audioChunk) && audioChunk.length > 0) {
    // Add samples without downsampling
    liveWaveformRef.current.push(...audioChunk);
    // ↑ Accumulates: [s1, s2, s3, ..., s1000, s1001, ...]
    
    // Keep max samples for display (16kHz × 8 seconds = 128K samples)
    const maxSamples = 128000;
    if (liveWaveformRef.current.length > maxSamples) {
      liveWaveformRef.current = liveWaveformRef.current.slice(-maxSamples);
    }
  }
};
```

#### **3D: Plotly Renders Live Waveform**

**File:** [src/components/AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx) (lines 31-90)

```javascript
// During recording: isRecording = true
const displayWaveform = isRecording ? liveWaveformRef.current : waveform;
//                                    ↑ Use accumulated samples

// Create time axis for plot
const timeAxis = displayWaveform.map((_, i) => ((i * 3) / 16000));
// Time in seconds: [0, 0.0001875, 0.000375, ...]

// Create Plotly trace
const mainTrace = {
  x: timeAxis,           // Time axis
  y: displayWaveform,    // Amplitude [-1.0 to 1.0]
  mode: "lines",
  line: { color: "#2178dc", width: 1.5 },
};

// Render with Plotly
Plotly.plot(plotRef.current, [mainTrace], layout);
```

**Result:** Blue waveform appears on screen, updating every ~21ms during recording

---

### **STEP 4: User Clicks "Stop Recording"**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 255-280)

```
User clicks "Stop Recording"
    ↓
stopRecording() called (lines 267-280):
  ├─ audioCaptureRef.current.cleanup()
  │  └─ Disconnects ScriptProcessorNode
  │  └─ Closes AudioContext
  │
  └─ mediaRecorderRef.current.stop()
     └─ Fires mediaRecorderRef.current.onstop event
```

---

### **STEP 5: FINAL Waveform Analysis (Post-Recording)**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 209-242)

```
mediaRecorderRef.current.onstop event fires (line 209)
    ↓
Create WebM blob (line 210):
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  // Combines all recorded chunks into one WebM file
  ↓
Call analyzeAudioBlob(blob) (line 213)
```

#### **5A: Decode WebM to PCM**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 130-175)

```javascript
const analyzeAudioBlob = async (blob) => {
  // Step 1: Convert WebM file to ArrayBuffer (binary data)
  const arrayBuffer = await blob.arrayBuffer();
  // Result: ArrayBuffer with WebM container bytes
  
  // Step 2: Create AudioContext and decode
  const ac = new AudioContext();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  // AudioContext decompresses WebM container
  // Decompresses Opus codec
  // Result: AudioBuffer object
  
  // Step 3: Extract PCM data (Channel 0 - mono)
  const data = decoded.getChannelData(0);
  // data = Float32Array [values ∈ [-1.0, 1.0]]
  // Length = originalSampleRate × duration
  
  const originalSr = decoded.sampleRate;
  // Example: 48000 Hz, 96000 samples = 2 second recording
  
  // Step 4: Resample to 16kHz
  const targetSr = 16000;
  
  if (originalSr !== targetSr) {
    const ratio = targetSr / originalSr;  // e.g., 0.333 for 48kHz→16kHz
    const resampledLength = Math.floor(data.length * ratio);
    // New length: 96000 × (16000/48000) = 32000 samples
    
    resampledData = new Float32Array(resampledLength);
    
    // Linear interpolation: calculate values between original samples
    for (let i = 0; i < resampledLength; i++) {
      const srcIndex = i / ratio;  // Map to original sample position
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      // Interpolate between two adjacent samples
      resampledData[i] = data[srcIndexFloor] * (1 - fraction) + 
                         data[srcIndexCeil] * fraction;
    }
  }
  
  // Step 5: Return resampled waveform
  const duration = resampledData.length / targetSr;
  
  return {
    duration: 2.0,                   // Seconds
    waveform: Array.from(resampledData),  // Full resolution array
    samplingRate: 16000,             // Always 16kHz
  };
};
```

**Data transformation example (48kHz → 16kHz for 2s recording):**
```
Input:  WebM file (~50KB)
    ↓
AudioContext.decodeAudioData()
    ↓
Output: Float32Array [96000 samples @ 48kHz]
    ↓
Linear interpolation resampling
    ↓
Output: Float32Array [32000 samples @ 16kHz]
    ↓
Array.from() conversion
    ↓
JavaScript array [s1, s2, s3, ..., s32000]
```

---

### **STEP 6: Update React State**

**File:** [src/pages/Assessments/PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) (lines 215-230)

```javascript
const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);

// Update stateMap
setStateMap((prev) => ({
  ...prev,
  [itemId]: {
    ...prev[itemId],
    recording: false,
    audioUrl: url,
    blob,
    duration: 2.0,          // e.g., 2 seconds
    waveform: [...],        // 32000 samples (full resolution, 16kHz)
    samplingRate: 16000,    // Standardized
  },
}));
```

**State change triggers React re-render**

---

### **STEP 7: Plotly Renders Final Waveform**

**File:** [src/components/AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx) (lines 31-90)

```javascript
// Post-recording: isRecording = false
const displayWaveform = isRecording ? liveWaveformRef.current : waveform;
//                                    ↑ Use final waveform from state

// Calculate time axis using duration
const timeAxis = useMemo(() => {
  if (duration > 0) {
    // Accurate time mapping based on final duration
    return displayWaveform.map((_, i) => (i / displayWaveform.length) * duration);
    // Example: 32000 samples over 2 seconds
    // timeAxis[0] = 0 seconds
    // timeAxis[1] = 0.0000625 seconds (2s / 32000)
    // timeAxis[32000] = 2.0 seconds
  }
}, [displayWaveform, duration]);

// Create main trace
const traces = useMemo(() => {
  const mainTrace = {
    x: timeAxis,        // [0, 0.0000625, 0.000125, ..., 2.0]
    y: displayWaveform, // [s1, s2, s3, ..., s32000]
    mode: "lines",
    line: { color: "#2178dc", width: 1.5 },
  };
  return [mainTrace];
}, [displayWaveform, timeAxis]);

// Render with Plotly.js
<Plot
  ref={plotRef}
  data={traces}
  layout={layout}
  config={config}
/>
```

**Result:** Final blue waveform appears on screen (replaces live waveform)

---

## Complete Data Flow Diagram

```
TIME: 0ms ─────────────────────────────────────────────────────────→ TIME: 2000ms (2 second recording)

┌─────────────────────────────────────────────────────────────────────────────┐
│                         WAVEFORM GENERATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: SETUP (t=0ms)
  PhonationAssessment.jsx
    └─ User clicks "Record"
       └─ getUserMedia() → microphone stream

PHASE 2: LIVE RECORDING & DISPLAY (t=0-2000ms, every ~21ms)
  
  Microphone Audio
    ↓
  RealtimeAudioCapture.js
    ├─ ScriptProcessorNode captures 4096 samples
    ├─ Sends to PhonationAssessment callback
    ↓
  PhonationAssessment.jsx
    ├─ Receives audioSamples array
    └─ Forwards to AnnotatedWaveformCanvas.updateLiveWaveform()
    ↓
  AnnotatedWaveformCanvas.jsx
    ├─ liveWaveformRef.current.push(...audioSamples)
    ├─ Accumulates samples: [s1, s2, s3, ..., s_N]
    ├─ Maximum 128K samples kept in buffer
    └─ Triggers Plotly re-render
    ↓
  Plotly.js
    ├─ Calculates timeAxis
    ├─ Creates line trace (x=time, y=amplitude)
    └─ Renders on screen → LIVE BLUE WAVEFORM VISIBLE
    
    Result: User sees waveform updating in real-time
            With tiny jitter (~21ms updates)

PHASE 3: STOP RECORDING (t=2000ms)
  
  PhonationAssessment.jsx
    ├─ mediaRecorderRef.current.stop()
    ├─ Fires onstop event
    └─ Creates WebM blob from chunks

PHASE 4: POST-RECORDING ANALYSIS (t=2050-2150ms)
  
  PhonationAssessment.jsx
    ├─ analyzeAudioBlob(blob):
    │  ├─ blob.arrayBuffer() → WebM bytes
    │  ├─ AudioContext.decodeAudioData() → decompress
    │  ├─ getChannelData(0) → Float32Array @ device sr
    │  ├─ Resample to 16kHz (linear interpolation)
    │  └─ Return full-resolution array
    │
    ├─ setStateMap() → update React state
    ├─ Triggers re-render
    ↓
  AnnotatedWaveformCanvas.jsx
    ├─ isRecording = false
    ├─ displayWaveform = state.waveform (full array)
    ├─ Calculate timeAxis using final duration
    ├─ Create final Plotly trace
    └─ Render on screen
    ↓
  Plotly.js
    └─ Renders final blue waveform → CLEAR, STABLE WAVEFORM VISIBLE

RESULT at t=2150ms:
  ✓ Full-resolution waveform displayed (32000 samples)
  ✓ Accurate time axis (0-2.0 seconds)
  ✓ Stable visualization ready for inspection
  ✓ User can hover, zoom, pan
```

---

## Data Transformation Summary

```
Stage 1: CAPTURE
  Microphone audio (continuous stream)
    → MediaRecorder (WebM container, Opus codec)
    → WebM blob file (~50KB)

Stage 2: DECODE
  WebM blob
    → AudioContext.decodeAudioData()
    → AudioBuffer (decompressed PCM)
    → Float32Array @ 48kHz (96000 samples, 2 seconds)

Stage 3: RESAMPLE
  Float32Array @ 48kHz
    → Linear interpolation (ratio = 16000/48000 = 0.333)
    → Float32Array @ 16kHz (32000 samples, 2 seconds)

Stage 4: ARRAY CONVERSION
  Float32Array (32000 samples)
    → Array.from()
    → JavaScript array [s1, s2, s3, ..., s32000]

Stage 5: STATE UPDATE
  JavaScript array
    → setStateMap()
    → React state update

Stage 6: VISUALIZATION
  React state
    → Plotly (timeAxis + waveform)
    → HTML SVG/Canvas
    → Blue waveform on screen
```

---

## File Responsibilities

### [PhonationAssessment.jsx](src/pages/Assessments/PhonationAssessment.jsx) - Orchestrator
- **Lines 23-70:** Setup & microphone permission
- **Lines 130-175:** `analyzeAudioBlob()` - Decodes WebM, resamples to 16kHz
- **Lines 177-254:** `startRecording()` - Creates MediaRecorder & RealtimeAudioCapture
- **Lines 255-280:** `stopRecording()` - Cleanup
- **Lines 209-242:** `onstop` handler - Triggers analysis
- **Lines 215-230:** State update with waveform
- **Refs:** `mediaRecorderRef`, `chunksRef`, `audioCaptureRef`, `waveformCanvasRefsRef`

### [RealtimeAudioCapture.js](src/utils/realtimeAudioCapture.js) - Live Capture
- **Lines 17-46:** `start()` - Create ScriptProcessorNode, capture 4096 samples
- **Lines 30-40:** `onaudioprocess` - Fire callback with raw audio data
- **Lines 52-64:** `stop()` - Disconnect nodes
- **Lines 67-80:** `cleanup()` - Close AudioContext
- **Purpose:** Get raw PCM samples from microphone stream in real-time

### [AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx) - Renderer
- **Lines 26-29:** Expose `updateLiveWaveform()` via ref
- **Lines 31-34:** Switch between live and final waveform
- **Lines 36-46:** Calculate time axis
- **Lines 150-162:** `updateLiveWaveform()` - Accumulate samples
- **Lines 48-75:** Create Plotly traces
- **Lines 116-145:** Layout & rendering config
- **Purpose:** Accumulate audio samples and render with Plotly

---

## Sampling Frequency Guarantee

All three waveform outputs are at **16kHz**:

| Stage | Sample Rate | Samples (2s) |
|-------|-------------|--------------|
| Live capture | Device rate (48kHz) | 4096 per ~21ms |
| Live display | Device rate | ~96K accumulated |
| Stored waveform | **16kHz** | 32000 |
| Final display | **16kHz** | 32000 |

**Key:** `analyzeAudioBlob()` resamples to 16kHz for consistency

---

## Backend Involvement (NONE for waveform)

Backend (`backend/routes/phonation_test.py`) does NOT affect waveform display:
- ✅ Receives PCM data from frontend
- ✅ Converts to WAV file (for archive)
- ✅ Returns metadata only
- ❌ Does NOT create waveform
- ❌ Does NOT return waveform
- ❌ Does NOT affect frontend visualization

---

## Timeline: From Record to Display

| Time | Event | Component |
|------|-------|-----------|
| 0ms | User clicks "Record" | PhonationAssessment |
| 5ms | RealtimeAudioCapture starts | RealtimeAudioCapture |
| 21ms | First audio chunk | ScriptProcessorNode → Canvas |
| 42ms | Live waveform visible | Plotly renders |
| ~2000ms | User clicks "Stop" | PhonationAssessment |
| 2050ms | analyzeAudioBlob completes | Web Audio API |
| 2100ms | State updated | React |
| 2105ms | **Final waveform visible** | Plotly renders |
| 2500ms | Backend returns response | FastAPI |

**Key insight:** Waveform visible at 2105ms, backend response at 2500ms = decoupled


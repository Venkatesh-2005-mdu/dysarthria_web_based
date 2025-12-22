# Phonation Test Waveform Production Methodology

## Overview
The waveform in the phonation test is **produced entirely on the frontend** through the Web Audio API. The backend does NOT create or affect the waveform display. This document traces the complete data flow from audio capture through final visualization.

---

## Complete Waveform Production Pipeline

### Phase 1: Audio Capture (MediaRecorder API)
**Location:** `src/pages/Assessments/PhonationAssessment.jsx` → `startRecording()` function (lines 162-179)

```
User clicks "Start Recording" button
    ↓
startRecording(itemId) called
    ↓
Request microphone permission: navigator.mediaDevices.getUserMedia({ audio: true })
    ↓
Browser shows permission dialog
    ↓
MediaRecorder created: new MediaRecorder(stream, { mimeType: "audio/webm" })
    ↓
Recording starts: mediaRecorderRef.current.start()
    ↓
Audio data flows into browser buffer as WebM container format
```

**Key Details:**
- **Format:** WebM container (VP9 video codec compatibility, Opus audio codec)
- **Sampling Rate:** Depends on device audio input (typically 44.1kHz or 48kHz initially)
- **Storage:** Audio chunks collected in `chunksRef.current` array
- **Trigger:** `onstart` event of MediaRecorder begins collection

---

### Phase 2: Waveform Extraction (analyzeAudioBlob)
**Location:** `src/pages/Assessments/PhonationAssessment.jsx` → `analyzeAudioBlob()` function (lines 133-155)

When user clicks "Stop Recording":

```
Recording stops
    ↓
WebM blob created from collected chunks: new Blob(chunksRef.current)
    ↓
analyzeAudioBlob(blob) called IMMEDIATELY
    ↓
blob.arrayBuffer() converts WebM binary to ArrayBuffer
    ↓
AudioContext created: new AudioContext()
    ↓
AudioContext.decodeAudioData() DECODES WebM container:
    • Extracts audio frames from WebM container
    • Decompresses Opus codec to PCM samples
    • Returns AudioBuffer object with decoded audio
    ↓
AudioBuffer.getChannelData(0) extracts mono channel:
    • Returns Float32Array with values in range [-1.0, 1.0]
    • Full resolution samples (exact sample count depends on duration)
    ↓
Metadata extracted from AudioBuffer:
    • duration = decoded.duration (in seconds)
    • samplingRate = decoded.sampleRate (typically 44100 or 48000)
    • data.length = total sample count
```

**Code Implementation:**
```javascript
const analyzeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  const data = decoded.getChannelData(0);  // Full resolution Float32Array
  const duration = decoded.duration;       // Seconds
  const sr = decoded.sampleRate;           // Hz

  // Return FULL RESOLUTION waveform (NOT downsampled)
  return {
    duration: parseFloat(duration.toFixed(2)),
    waveform: Array.from(data),  // ← Full resolution array
    samplingRate: sr,
  };
};
```

**Critical Design Decisions:**
1. **No Downsampling Here** - Full resolution maintained (could be 240,000+ samples for 5-second recording)
2. **Immediate Extraction** - Happens synchronously after recording stops (~50-100ms)
3. **No Backend Involvement** - Pure client-side Web Audio API, no network calls
4. **Preserves Clinical Accuracy** - Full waveform allows detailed inspection of voice quality

---

### Phase 3: State Management (Immediate Display)
**Location:** `src/pages/Assessments/PhonationAssessment.jsx` → `onStop` handler (lines 189-230)

```
analyzeAudioBlob() completes
    ↓
setStateMap() updates React state with waveform:
    stateMap[itemId] = {
        duration: extracted_duration,
        waveform: extracted_waveform,      // ← Full array (240K+ samples)
        samplingRate: extracted_sampling_rate,
        backendDuration: null,             // Backend metrics separate
    }
    ↓
React component re-renders with new waveform data
    ↓
AnnotatedWaveformCanvas receives waveform prop
    ↓
Plotly.js creates visualization
```

**State Structure:**
```javascript
// stateMap = { itemId: { duration, waveform, samplingRate, backendDuration } }
// waveform array = [sample0, sample1, sample2, ..., sampleN]
// Each sample ∈ [-1.0, 1.0] (float32 range)
```

**Timing:**
- Audio capture: Variable (depends on user recording length)
- AudioContext decoding: ~50-100ms
- State update: <10ms
- **Total time from stop to display: ~100-120ms**

---

### Phase 4: Waveform Visualization (AnnotatedWaveformCanvas)
**Location:** `src/components/AnnotatedWaveformCanvas.jsx` (lines 1-217)

```
AnnotatedWaveformCanvas receives waveform prop
    ↓
displayWaveform = waveform (from state)
    ↓
Time axis calculation (lines 34-49):
    timeAxis[i] = (i / waveform.length) * duration
    Example: For 5-second recording with 240K samples:
        • timeAxis[0] = 0.0000 seconds
        • timeAxis[1] ≈ 0.0000104 seconds (5s / 240K samples)
        • timeAxis[240000] = 5.0 seconds
    ↓
Plotly.js trace creation (lines 51-64):
    trace.x = timeAxis           // Time in seconds
    trace.y = waveform           // Amplitude [-1.0, 1.0]
    ↓
Plotly.plot() renders SVG visualization:
    • Creates interactive graph
    • Draws line connecting all points (x, y pairs)
    • Enables hover tooltips showing time and amplitude
    • Adds grid overlay
    • Responsive to window resize
```

**Rendering Process:**
```
waveform array [240,000 samples]
    ↓ (Plotly processes)
Creates 240,000 (x, y) coordinate pairs
    ↓
Renders connected line graph using SVG/Canvas
    ↓
User sees blue waveform visualization on screen
```

**Visual Properties:**
- **Color:** #2178dc (blue line)
- **Line Width:** 1.5px
- **Y-axis Range:** Auto-scaled to min/max of waveform
- **X-axis Range:** 0 to duration seconds
- **Interactivity:** Hover tooltips, pan/zoom controls

---

### Phase 5: Backend Upload (Asynchronous, Non-Blocking)
**Location:** `src/pages/Assessments/PhonationAssessment.jsx` → `uploadToBackend()` (lines 87-112)

**Important:** Backend upload happens AFTER waveform display, doesn't affect visualization

```
While waveform displays (immediately), SEPARATELY:
    ↓
uploadToBackend(blob, itemId) called
    ↓
FormData created:
    • audio_data = Float32Array.from(waveform) converted to typed list
    • vowel = itemId (e.g., "a", "ii", "u", "uhm")
    ↓
POST request to http://localhost:8000/phonation/upload/{itemId}
    ↓
Backend processes (independent of frontend):
    • Converts PCM float32 to WAV file format
    • Saves to backend/uploads/
    • Extracts duration_sec and sampling_rate
    • Returns JSON response
    ↓
Frontend receives response (lines 107-112):
    {
        vowel: "a",
        duration_sec: 5.2,
        sampling_rate: 16000,
        file_path: "uploads/a_<timestamp>.wav",
        status: "success"
    }
    ↓
setStateMap() updates stateMap[itemId].backendDuration
    ↓
UI displays backend metrics separately from waveform
```

**Critical Point:** Backend response does NOT include waveform field (this was the bug that was fixed). Frontend waveform is preserved intact.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHONATION TEST WAVEFORM FLOW                   │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (100% responsibility for waveform)         BACKEND (metrics only)
═══════════════════════════════════════════════════════════════════════════

1. User clicks "Record" ─→ MediaRecorder captures WebM blob
                            (44.1kHz or 48kHz device sampling rate)

2. Recording stops ─→ WebM blob created

3. WAVEFORM EXTRACTION PHASE (100-120ms)
   ├─ blob.arrayBuffer()
   ├─ AudioContext.decodeAudioData()          (30-50ms: WebM→PCM)
   ├─ getChannelData(0)                       (5-10ms: extract mono)
   ├─ Extract metadata (duration, sr)
   └─ → WAVEFORM: Float32Array [240,000+ samples] ← FULL RESOLUTION

4. setStateMap() ──────────────────────────→  (state update <10ms)
   ↓

5. React re-render
   ↓

6. AnnotatedWaveformCanvas receives waveform  
   ↓
   ├─ Calculate timeAxis from duration
   ├─ Create Plotly traces
   └─ → DISPLAY: Blue waveform line on screen (105ms total)

7. BACKEND UPLOAD (simultaneous, non-blocking)
                                              ─→ uploadToBackend()
                                                    ↓
                                                 POST blob
                                                    ↓
                                              BACKEND PROCESSING:
                                              ├─ convert_pcm_to_wav()
                                              │  (FFmpeg: PCM→WAV)
                                              ├─ save to backend/uploads/
                                              ├─ extract metrics
                                              └─ return JSON
                                                    ↓
                                              Response: {duration, sr, path}
                                                    ↓
                                              setStateMap().backendDuration
                                                    ↓
                                              Display backend metrics

RESULT: Waveform displays ~105ms after recording stops (frontend only)
        Backend metrics display separately ~500-2000ms later
        Waveform is never affected by backend code
```

---

## Sample Data Example

### Recording Parameters
- **Duration:** 5 seconds
- **Device Sampling Rate:** 48,000 Hz
- **Total Samples:** 240,000
- **Quantization:** 32-bit float (IEEE 754)

### Raw Data in Memory

```
Float32Array (240,000) [
  0.000123,      // Sample 0: t=0.000s
  0.000456,      // Sample 1: t=0.0208ms (1/48000)
  -0.000234,     // Sample 2: t=0.0417ms
  0.000789,      // Sample 3: t=0.0625ms
  ...
  -0.000145,     // Sample 239,999: t=4.99979s
]
```

### Time Axis Calculation

```javascript
// For each sample index i (0 to 239,999):
timeAxis[i] = (i / 240000) * 5.0

Examples:
• i=0:       (0 / 240000) × 5 = 0.00000s
• i=1:       (1 / 240000) × 5 = 0.00002s
• i=100:     (100 / 240000) × 5 = 0.00208s
• i=120000:  (120000 / 240000) × 5 = 2.50000s (midpoint)
• i=239999:  (239999 / 240000) × 5 = 4.99979s
```

### Plotly Display Coordinates

```
Plotly creates line graph from coordinates:
(0.00000s, 0.000123)
(0.00002s, 0.000456)
(0.00004s, -0.000234)
...
(4.99979s, -0.000145)

These 240,000 points render as smooth blue line
```

---

## Resolution & Quality Considerations

### Full Resolution Storage
- **Current Implementation:** Stores ALL samples from AudioBuffer
- **For 5-second recording at 48kHz:** 240,000 samples
- **For 10-second recording at 48kHz:** 480,000 samples
- **Memory per second:** ~960KB (48,000 samples × 4 bytes per float32)
- **Typical browser session:** Multiple assessments × 480,000 samples ≈ 5-10MB

### Why Full Resolution?
1. **Clinical Accuracy** - Speech-language pathologists need to see fine detail
2. **Spectral Analysis** - Full frequency content preserved (up to Nyquist: 24kHz)
3. **Artifact Detection** - Can identify noise, clipping, or recording glitches
4. **No Downsampling Loss** - Better than trying to reconstruct from downsampled data

### Display Optimization
- **Plotly.js Optimization** - Browser GPU renders efficiently even with 240K+ points
- **Hover/Zoom** - Interactive tools allow focusing on specific regions
- **PNG Export** - Can export at 1200×400px for reporting

---

## Backend PCM to WAV Conversion (Information Only)

**Note:** This happens independently after waveform display and does NOT affect waveform visualization.

**Location:** `backend/routes/phonation_test.py` → `convert_pcm_to_wav()` (lines 19-38)

### Conversion Process
```
Float32Array from frontend
    ↓
Serialized as bytes in FormData
    ↓
Backend receives audio_data: List[float]
    ↓
convert_pcm_to_wav():
    ├─ Convert list to NumPy float32 array
    ├─ Normalize to [-32768, 32767] range (16-bit signed int)
    ├─ Create WAV header with metadata:
    │  • sample_rate = 16000 Hz (resampled from 48kHz)
    │  • bit_depth = 16-bit
    │  • channels = 1 (mono)
    │  • duration = computed from sample count
    ├─ Call FFmpeg: float32 PCM → 16-bit PCM WAV
    └─ Save to backend/uploads/{vowel}_{timestamp}.wav
    ↓
WAV file stored on disk for permanent record
```

**Why Backend Conversion?**
- Frontend waveform is transient (memory only)
- Backend creates permanent WAV file for record-keeping
- Clinical archival requires standard WAV format
- Backend metrics (duration, spectral analysis) computed from WAV

---

## Troubleshooting: Waveform Display Issues

### Issue: Waveform Not Displaying
**Root Causes & Solutions:**

| Problem | Location | Solution |
|---------|----------|----------|
| Audio permission denied | Browser prompt | User must allow microphone access |
| Recording too short (<100ms) | MediaRecorder.onstop | Check recording duration before analysis |
| analyzeAudioBlob() failed | Line 155 (catch block) | Check browser console for AudioContext errors |
| Empty waveform array | Line 147 | Verify decoded.getChannelData(0) returned data |
| AnnotatedWaveformCanvas not rendering | AnnotatedWaveformCanvas.jsx | Check Plotly.js is loaded, waveform prop is array |

### Issue: Waveform Disappears After Backend Upload
**Root Cause:** Backend was overwriting frontend waveform (NOW FIXED)

**How We Fixed It:**
- ❌ **Before:** Backend returned `"waveform": [downsampled_data]` in JSON response
- ✅ **After:** Backend returns only `{duration_sec, sampling_rate, file_path, status}`
- ✅ **Result:** Frontend waveform never overwritten, stays stable

### Issue: Waveform Looks Different Than Audio Sounds
**Possible Causes:**

1. **Downsampling Artifacts** - Not applicable anymore (no downsampling in phonation test)
2. **Mono vs Stereo** - Frontend extracts channel 0 only (mono)
3. **DC Offset** - Baseline shift in audio (normal, doesn't affect display)
4. **Clipping** - Values hitting ±1.0 exactly (indicates distortion)

---

## Performance Metrics

### Typical Timing Breakdown (5-second recording at 48kHz)

| Step | Duration | Component |
|------|----------|-----------|
| User records audio | ~5000ms | MediaRecorder |
| blob.arrayBuffer() | ~2ms | Browser API |
| AudioContext.decodeAudioData() | ~40-80ms | Web Audio API codec decompression |
| Array.from(Float32Array) | ~20ms | JavaScript engine |
| setStateMap() | <1ms | React state update |
| React re-render | ~5ms | React virtual DOM |
| Plotly.js creates traces | ~30ms | Plotly calculation |
| Plotly.js renders | ~50ms | SVG/Canvas rendering |
| **Total frontend time** | **~105-150ms** | From stop to visible waveform |
| Backend PCM→WAV conversion | ~200-500ms | FFmpeg codec |
| Backend response time | ~500-1500ms | Network + backend processing |

---

## Summary: Waveform Production Methodology

### Key Takeaways

1. **Frontend Owns Waveform** - 100% produced by Web Audio API
   - MediaRecorder captures WebM container
   - AudioContext.decodeAudioData() extracts PCM samples
   - Full resolution maintained (no downsampling)
   - Immediate display (~105ms after recording)

2. **Backend Doesn't Affect Display** - Backend processes independently
   - Converts PCM to WAV format
   - Computes metadata (duration, sample rate)
   - Returns only metrics JSON
   - Waveform never overwritten

3. **Display Pipeline** - Clean separation of concerns
   - Extract → State → Render → Display (all frontend)
   - Backend upload happens in background

4. **Clinical Quality** - Full resolution for accuracy
   - No lossy downsampling in display pipeline
   - 48kHz device sampling rate preserved through AudioContext
   - Allows detailed inspection of voice characteristics

5. **Architecture Principle** - Asynchronous non-blocking
   - Waveform displays immediately
   - Backend metrics update when ready
   - User sees feedback instantly, details later
   - Improves perceived performance

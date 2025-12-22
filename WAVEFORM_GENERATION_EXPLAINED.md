# Waveform Generation Explained: Frontend vs Backend

## The Key Discovery: **Waveforms are generated CLIENT-SIDE, not by the backend**

You're getting waveforms WITHOUT the backend running correctly because the **entire waveform extraction happens in the browser using the Web Audio API**, completely independent of your Python backend.

---

## Data Flow Breakdown

### 🎙️ **Step 1: Audio Recording (Frontend)**
- User clicks "Record" in RessonanceAndArticulationAssessment.jsx
- Browser captures audio via `MediaRecorder` API
- Creates a **WebM blob** (compressed audio)

```javascript
mediaRecorderRef.current.start();
// ... recording ...
const blob = new Blob(chunksRef.current, { type: "audio/webm" });
```

---

### 📊 **Step 2: Waveform Extraction (Frontend - Web Audio API)**
**This is 100% client-side. No backend needed.**

When recording stops, `analyzeAudioBlob()` extracts the waveform:

```javascript
const analyzeAudioBlob = async (blob) => {
  // Convert compressed WebM blob to raw PCM audio
  const arrayBuffer = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(arrayBuffer);  // ← Browser decoding
  
  const data = decoded.getChannelData(0);      // Raw audio samples
  const duration = decoded.duration;           // Calculated from samples
  const sr = decoded.sampleRate;               // Typically 48000
  
  // Downsample to 2000 points for visualization
  const maxPoints = 2000;
  const factor = Math.ceil(data.length / maxPoints);
  const downsampled = [];
  
  for (let i = 0; i < data.length; i += factor) {
    downsampled.push(data[i]);  // ← These are the waveform points
  }
  
  return {
    duration,           // ← Duration extracted here
    waveform: downsampled,  // ← Waveform extracted here
    samplingRate: sr,   // ← Sample rate from Web Audio API
    rawAudio: data      // ← Full audio data
  };
};
```

**Where it's called:**
```javascript
// Line 298 in RessonanceAndArticulationAssessment.jsx
const { duration, waveform, samplingRate, rawAudio } = await analyzeAudioBlob(blob);

// Immediately stored in React state
setResonanceRecording((prev) => ({
  ...prev,
  recording: false,
  audioUrl: url,
  blob,
  duration,        // ← From analyzeAudioBlob
  waveform,        // ← From analyzeAudioBlob
  samplingRate,    // ← From analyzeAudioBlob
  metrics,         // ← From backend (if it runs)
  spectrogram,     // ← From backend (if it runs)
}));
```

---

### 🚀 **Step 3a: Backend Upload (Optional - for metrics only)**
**If your backend IS running correctly**, the audio blob is separately uploaded:

```javascript
const analysisResult = await uploadResonanceToBackend(blob);
// Backend receives the WebM file and:
// - Loads it with librosa
// - Performs LPC analysis
// - Extracts A1, P0, nasality ratio
// - Generates spectrogram
// - Returns metrics
```

**Important:** The backend does NOT generate the waveform. It only:
- ✅ Extracts clinical metrics (A1 frequency, P0, nasality ratio, classification)
- ✅ Generates spectrograms for advanced visualization
- ❌ Does NOT extract the waveform (already done client-side)

---

## Why This Architecture?

| Operation | Location | Reason |
|-----------|----------|--------|
| **Waveform extraction** | Frontend (Web Audio API) | Instant visual feedback, doesn't require backend |
| **Duration calculation** | Frontend (Web Audio API) | Available immediately after decoding |
| **Clinical metrics (A1, P0, nasality)** | Backend (Python librosa/scipy) | Requires signal processing libraries |
| **Spectrogram** | Backend (Python librosa) | Complex FFT analysis |
| **Live waveform display** | Frontend (RealtimeAudioCapture) | Real-time updates during recording |

---

## The Waveform Data Structure

Each waveform point is a **normalized audio sample** (-1.0 to +1.0 range):

```javascript
waveform = [
  0.002,    // Sample at t=0
  -0.001,   // Sample at t=1
  0.015,    // Sample at t=2
  -0.008,   // Sample at t=3
  // ... 2000 points total (downsampled from ~500,000 original samples)
]
```

**Downsampling formula:**
- Original samples: ~500,000 (varies by duration/bitrate)
- Display points: 2,000 (hardcoded `maxPoints`)
- Sample every Nth sample where N = original_samples / 2000

---

## Why Your Backend Issues Don't Affect Waveforms

1. **Web Audio API is built-in** to all modern browsers
   - No external libraries needed
   - No server dependency
   - Works completely offline

2. **Backend serves a different purpose:**
   - Waveform ✅ Client extracts (this you see)
   - Metrics ❌ Backend extracts (you won't see if backend fails)
   - Spectrogram ❌ Backend generates (you won't see if backend fails)

3. **The split allows graceful degradation:**
   - Backend down? You still see waveforms and duration
   - Backend down? You lose clinical metrics and spectrograms
   - This is why you see partial results even without backend

---

## Testing This Understanding

**Scenario 1: Backend running**
```
User records → Frontend: waveform ✓, duration ✓ 
            → Backend: metrics ✓, spectrogram ✓
Result: Full assessment with all data
```

**Scenario 2: Backend NOT running**
```
User records → Frontend: waveform ✓, duration ✓ 
            → Backend: ERROR (can't upload)
Result: You still see waveforms, but no nasality ratio, A1/P0 frequencies
```

This is exactly what you're experiencing!

---

## Code Locations

- **Frontend waveform extraction:** [RessonanceAndArticulationAssessment.jsx](src/pages/Assessments/RessonanceAndArticulationAssessment.jsx#L139)
- **Waveform usage:** Lines 298, 431, 509
- **Waveform display component:** [AnnotatedWaveformCanvas.jsx](src/components/AnnotatedWaveformCanvas.jsx)
- **Backend resonance metrics:** [resonance_analysis.py](backend/routes/resonance_analysis.py)
- **Real-time waveform during recording:** [realtimeAudioCapture.js](src/utils/realtimeAudioCapture.js)

---

## Summary

The waveform you see is **extracted purely by the browser's Web Audio API** in the `analyzeAudioBlob()` function. Your backend can be completely broken and you'll still see perfect waveforms—they're client-side. The backend's job is to provide advanced analysis metrics and spectrograms, not the waveform itself.

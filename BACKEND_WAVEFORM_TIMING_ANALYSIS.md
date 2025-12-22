# Backend & Waveform Display: Relationship Analysis

## **SHORT ANSWER: YES, the backend indirectly affects waveform DISPLAY TIMING, but NOT the waveform DATA itself**

---

## The Critical Sequence

### **In `RessonanceAndArticulationAssessment.jsx` (lines 293-340):**

```javascript
mediaRecorderRef.current.onstop = async () => {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  const url = URL.createObjectURL(blob);

  // STEP 1: WAVEFORM EXTRACTION (Frontend only, INSTANT ~100ms)
  const { duration, waveform, samplingRate, rawAudio } = await analyzeAudioBlob(blob);
  //                                                      ↑
  //                                      This uses Web Audio API
  //                                      Does NOT depend on backend

  // STEP 2: BACKEND ANALYSIS (SLOW, 500ms-2000ms depending on audio length)
  const analysisResult = await uploadResonanceToBackend(blob);
  //                      ↑
  //                      This WAITS for backend response
  //                      Blocks state update!

  // STEP 3: ONLY AFTER BACKEND COMPLETES - Update state with EVERYTHING
  setResonanceRecording((prev) => ({
    ...prev,
    recording: false,
    audioUrl: url,
    blob,
    duration,              // ← From analyzeAudioBlob
    waveform,              // ← From analyzeAudioBlob (FRONTEND ONLY)
    samplingRate,          // ← From analyzeAudioBlob
    metrics,               // ← From backend (or null if backend fails)
    spectrogram: spectrogramData,           // ← From backend (or null)
    spectrogramFrequencies,                 // ← From backend (or null)
    spectrogramTimes,                       // ← From backend (or null)
  }));
};
```

---

## Timeline: What You're Observing

### **Scenario 1: Backend NOT Running (or errors out)**

```
Time     Event                                  Display State
───────────────────────────────────────────────────────────
0ms      Recording stops
         ├─ analyzeAudioBlob() starts           [blank]
         
100ms    ├─ analyzeAudioBlob() completes        [blank]
         ├─ uploadResonanceToBackend() starts   [blank]
         │  (attempts to connect to backend)
         
300ms    ├─ uploadResonanceToBackend() FAILS    [blank]
         │  (connection refused or timeout)
         │
         ├─ analysisResult = null
         ├─ metrics = null
         ├─ spectrogramData = null
         │
         └─ setResonanceRecording() called
         
305ms    WAVEFORM APPEARS!                      ✓ Waveform visible
         Metrics: MISSING                       ✗ No A1/P0/nasality
         Spectrogram: MISSING                   ✗ No spectrogram
```

**Result:** You see waveform + duration, but NO clinical metrics or spectrogram

---

### **Scenario 2: Backend IS Running (normal flow)**

```
Time     Event                                  Display State
───────────────────────────────────────────────────────────
0ms      Recording stops
         ├─ analyzeAudioBlob() starts           [blank]
         
100ms    ├─ analyzeAudioBlob() completes        [blank]
         ├─ uploadResonanceToBackend() starts   [blank]
         │  (sends WebM to backend)
         
200ms    Backend receives, starts LPC analysis  [blank]
         
500ms    ├─ Backend computes LPC spectrum       [blank]
         ├─ Backend extracts A1, P0 peaks       [blank]
         ├─ Backend calculates nasality_ratio   [blank]
         ├─ Backend generates spectrogram       [blank]
         
600ms    ├─ uploadResonanceToBackend()          [blank]
         │  returns JSON response
         │
         ├─ metrics extracted from response
         ├─ spectrogram extracted from response
         │
         └─ setResonanceRecording() called
         
605ms    WAVEFORM APPEARS!                      ✓ Waveform visible
         WITH Metrics!                          ✓ A1/P0/nasality
         WITH Spectrogram!                      ✓ LPC spectrum plot
```

**Result:** You see everything - waveform + metrics + spectrogram

---

## Why The Display "Changes"

The waveform **DATA** (the actual array) is extracted instantly in `analyzeAudioBlob()` on the FRONTEND. But the **DISPLAY** is blocked by `await uploadResonanceToBackend()`.

### **The blocking code:**
```javascript
const { duration, waveform, samplingRate, rawAudio } = await analyzeAudioBlob(blob);
//                                                      ↑
//                                        Completes in ~100ms

const analysisResult = await uploadResonanceToBackend(blob);
//                      ↑
//                      BLOCKS HERE for 500-2000ms waiting for backend

// Nothing happens until backend responds
setResonanceRecording(...); // ← Only called after backend completes
```

---

## The Problem: Waveform Display is Delayed by Backend

**Current architecture:**
```
Recording stops
    ↓
Waveform extracted (100ms)
    ↓
WAIT for backend response (500-2000ms) ← BLOCKING
    ↓
Both waveform + metrics update together
```

**What you're seeing:**
- Backend NOT running: Instant waveform display (no metrics)
- Backend running slowly: 1-2 second delay before anything displays
- Backend running fast: Quick display of everything

---

## How to Fix: Decouple the Updates

The code should update waveform IMMEDIATELY, then update metrics separately:

```javascript
mediaRecorderRef.current.onstop = async () => {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  const url = URL.createObjectURL(blob);

  // IMMEDIATE: Extract and display waveform
  const { duration, waveform, samplingRate, rawAudio } = await analyzeAudioBlob(blob);

  // UPDATE STATE IMMEDIATELY (no metrics yet)
  setResonanceRecording((prev) => ({
    ...prev,
    recording: false,
    audioUrl: url,
    blob,
    duration,
    waveform,
    samplingRate,
    metrics: null,           // Empty for now
    spectrogram: null,
    analysisInProgress: true // Show loading spinner
  }));

  // ASYNC: Backend analysis in background (non-blocking)
  const analysisResult = await uploadResonanceToBackend(blob);
  if (analysisResult) {
    const metrics = {
      resonanceType: analysisResult.classification?.status || "Unknown",
      // ... extract metrics ...
    };
    
    // UPDATE AGAIN when backend completes
    setResonanceRecording((prev) => ({
      ...prev,
      metrics,
      spectrogram: analysisResult.spectrogram,
      spectrogramFrequencies: analysisResult.spectrum_frequencies,
      spectrogramTimes: analysisResult.spectrogram_times,
      analysisInProgress: false
    }));
  } else {
    setResonanceRecording((prev) => ({
      ...prev,
      metrics: null,
      analysisInProgress: false
    }));
  }
};
```

**Result:**
```
Recording stops
    ↓
Waveform extracted (100ms)
    ↓
STATE UPDATE #1: Waveform appears INSTANTLY ✓
    ↓
Backend processes in background (500-2000ms)
    ↓
STATE UPDATE #2: Metrics appear when ready ✓
```

---

## Summary

| Aspect | Current Behavior | Reason |
|--------|------------------|--------|
| **Waveform DATA source** | Frontend (Web Audio API) | Browser decoding |
| **Waveform DISPLAY timing** | Delayed by backend | Blocking `await uploadResonanceToBackend()` |
| **Metrics source** | Backend (LPC analysis) | Python signal processing |
| **Metrics DISPLAY timing** | Same as waveform | Both in single `setState()` call |
| **Backend failure effect** | Waveform appears fast | Backend bypassed/null |
| **Backend slow effect** | Waveform appears slow | Blocking state update |

**The waveform itself is 100% frontend-generated, but its DISPLAY is blocked by the backend call.** The "change" you see is the state update happening earlier (no backend) or later (with backend).


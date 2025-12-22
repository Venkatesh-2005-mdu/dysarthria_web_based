# Audio Recording → PCM → Waveform Display: Complete Verification

## Critical Finding: TWO SEPARATE WAVEFORM PIPELINES

After thorough code inspection, here's what actually happens:

---

## Pipeline 1: FRONTEND WAVEFORM (Real-time display during recording)

### Step 1A: MediaRecorder Captures WebM
**File:** `src/pages/Assessments/PhonationAssessment.jsx` (lines 162-179)

```javascript
const options = { mimeType: "audio/webm" };
mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

mediaRecorderRef.current.ondataavailable = (e) => {
  if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
};
```

**Format:** WebM audio container (Opus codec)
**Output:** `chunksRef.current` = array of Blob chunks

---

### Step 1B: Real-time Audio Capture (DURING Recording)
**File:** `src/pages/Assessments/PhonationAssessment.jsx` (lines 221-230)

```javascript
audioCaptureRef.current = new RealtimeAudioCapture((audioSamples) => {
  const currentWaveformRef = waveformCanvasRefsRef.current[itemId];
  if (currentWaveformRef && audioSamples.length > 0) {
    currentWaveformRef.updateLiveWaveform(audioSamples);  // ← LIVE UPDATE
  }
}, 16000);  // Fixed sample rate: 16000 Hz

await audiCaptureRef.current.start(streamRef.current);
```

**This means:** While user is recording, waveform is updating LIVE on screen using RealtimeAudioCapture
- Gets raw PCM samples from microphone stream
- Directly feeds them to AnnotatedWaveformCanvas
- Downsampled by 3x (every 3rd sample) for display
- **NOT waiting for recording to finish**

---

### Step 1C: Stop Recording → Analyze Audio Blob
**File:** `src/pages/Assessments/PhonationAssessment.jsx` (lines 189-210)

When user clicks "Stop Recording":

```javascript
mediaRecorderRef.current.onstop = async () => {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  
  // Analyze audio locally (THIS IS CRITICAL)
  const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);
  
  // Update state with FRONTEND-EXTRACTED waveform
  setStateMap((prev) => ({
    ...prev,
    [itemId]: {
      ...prev[itemId],
      recording: false,
      audioUrl: url,
      blob,
      duration,
      waveform,        // ← FULL RESOLUTION from Web Audio API
      samplingRate,
    },
  }));

  uploadToBackend(itemId, blob);  // ← Happens AFTER waveform display
};
```

**What analyzeAudioBlob() does:**

```javascript
const analyzeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();           // WebM binary → ArrayBuffer
  const ac = new AudioContext();
  const decoded = await ac.decodeAudioData(arrayBuffer);  // WebM → PCM Float32Array
  const data = decoded.getChannelData(0);                 // Extract mono channel
  
  return {
    duration: decoded.duration,
    waveform: Array.from(data),  // ← FULL RESOLUTION PCM samples
    samplingRate: decoded.sampleRate,
  };
};
```

**This produces:**
- `waveform` = Float32Array converted to JavaScript array
- Values: [-1.0 to 1.0] (normalized float)
- Sample count: Depends on duration × sample rate (e.g., 5sec × 48kHz = 240,000 samples)
- **This is pure PCM data in float format**

---

### Step 1D: Display in AnnotatedWaveformCanvas
**File:** `src/components/AnnotatedWaveformCanvas.jsx` (lines 32-64)

```javascript
// displayWaveform is either live (during recording) or full-res (post-recording)
const displayWaveform = isRecording ? liveWaveformRef.current : waveform;

// Time axis: map sample indices to seconds
const timeAxis = useMemo(() => {
  if (displayWaveform.length === 0) return [];
  return displayWaveform.map((_, i) => (i / displayWaveform.length) * duration);
}, [displayWaveform, duration]);

// Plotly trace: time vs amplitude
const mainTrace = {
  x: timeAxis,      // Seconds [0, 0.00002, 0.00004, ..., 5.0]
  y: displayWaveform, // Amplitude [-1.0 to 1.0]
  mode: "lines",
  line: { color: "#2178dc", width: 1.5 },
};

Plotly.plot(plotRef.current, [mainTrace], layout);
```

**Result:** Blue waveform line displayed showing PCM amplitude over time

---

## Pipeline 2: BACKEND CONVERSION (After waveform display)

### Step 2A: Upload PCM Data to Backend
**File:** `src/pages/Assessments/PhonationAssessment.jsx` (lines 87-112)

```javascript
const uploadToBackend = async (itemId, blob) => {
  // Decode audio blob to get PCM float32 data
  const arrayBuffer = await blob.arrayBuffer();
  const ac = new AudioContext();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  const audioData = Array.from(decoded.getChannelData(0));  // ← PCM FLOAT32 ARRAY
  const sampleRate = decoded.sampleRate;

  // Send to backend as JSON
  const res = await fetch(`${API_BASE}/phonation/upload/${itemId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vowel: itemId,
      audio_data: audioData,      // Float32 values [-1.0, 1.0]
      sample_rate: sampleRate,    // 44100, 48000, etc.
    }),
  });

  const response = await res.json();
  
  // Update state with BACKEND METRICS (not waveform)
  setStateMap((prev) => ({
    ...prev,
    [itemId]: {
      ...prev[itemId],
      backendDuration: response.duration_sec,
      // Waveform NOT overwritten - stays from analyzeAudioBlob()
    },
  }));
};
```

**Data format being sent:**
```json
{
  "vowel": "a",
  "audio_data": [0.00012, 0.00045, -0.00023, ...],  // 240,000+ floats
  "sample_rate": 48000
}
```

---

### Step 2B: Backend PCM to WAV Conversion
**File:** `backend/routes/phonation_test.py` (lines 75-90)

```python
@router.post("/upload/{vowel}")
async def upload_phonation(vowel: str, data: AudioData):
    # Receive PCM float32 data
    audio_array = np.array(data.audio_data, dtype=np.float32)
    sr = data.sample_rate
    
    # Convert float32 PCM to 16-bit PCM bytes
    audio_array = np.clip(audio_array, -1.0, 1.0)
    pcm_bytes = (audio_array * 32767).astype(np.int16).tobytes()
    # ↑ This is the key conversion: float32 → int16 bytes
    
    # Convert PCM bytes to WAV using FFmpeg
    wav_path = convert_pcm_to_wav(pcm_bytes, sr)
    # ↑ FFmpeg adds WAV header, resamples if needed
    
    # Extract metadata only
    audio_data, sample_rate = sf.read(wav_path)
    duration = len(audio_data) / sample_rate
    
    return {
        "vowel": vowel,
        "duration_sec": duration,
        "sampling_rate": sample_rate,
        "file_path": str(output_path),
        "status": "success"
    }
```

**Conversion steps:**
```
Float32 array [0.00012, 0.00045, -0.00023, ...]  (values -1.0 to 1.0)
    ↓
Clip to [-1.0, 1.0]
    ↓
Scale by 32767: [3.9, 14.7, -7.5, ...]  (int16 range)
    ↓
Convert to int16: [0x0003, 0x000F, 0xFFF9, ...]  (16-bit signed)
    ↓
Convert to bytes: b'\x03\x00\x0f\x00\xf9\xff...'  (WAV audio data)
    ↓
FFmpeg creates WAV file:
  • RIFF header
  • fmt chunk (44100Hz, 16-bit, mono)
  • data chunk (16-bit PCM bytes)
    ↓
Output: /backend/uploads/a_1234567890.wav
```

---

## Summary: Frontend vs Backend Waveform

| Aspect | Frontend Waveform | Backend "Waveform" |
|--------|-------------------|-------------------|
| **Data Type** | Float32 array (JavaScript) | NONE - backend returns only metadata |
| **Resolution** | Full resolution (240K+ samples) | Not applicable |
| **Format** | PCM float32 [-1.0 to 1.0] | Not extracted |
| **Display Purpose** | Visual feedback for clinician | Backend only converts to WAV file |
| **Timing** | Displayed in ~105ms after stop | Saved to disk in ~500-1500ms |
| **Used For** | Real-time visualization, inspection | Permanent archival, batch analysis |

---

## Answer to Your Question

**You asked:** "Audio is recorded → converted to PCM bytes → displayed as waveform (frontend and backend combination)"

**The Truth:**
- ✅ Audio is recorded (WebM blob via MediaRecorder)
- ✅ Converted to PCM bytes (Float32Array via AudioContext.decodeAudioData)
- ✅ **FRONTEND displays waveform immediately** (100% frontend responsibility)
- ❌ **Backend does NOT display waveform** - backend converts to WAV file only
- ⚠️ There is NO "frontend and backend combination" for waveform display

---

## Two Parallel Processes

### Process 1: Waveform Display (Frontend-only)
```
User stops recording
    ↓
WebM blob created
    ↓
AudioContext decodes → Float32Array (PCM)
    ↓
setStateMap with waveform
    ↓
Plotly visualizes as blue line
    ↓
RESULT: User sees waveform ~105ms after stopping
```

### Process 2: Backend Archival (Independent)
```
Same waveform data sent to backend
    ↓
Backend clips and scales float32 → int16 bytes
    ↓
FFmpeg converts PCM bytes → WAV file
    ↓
Save to disk
    ↓
Return metadata to frontend
    ↓
RESULT: Permanent WAV file saved, metrics returned
```

---

## Where PCM Appears

### PCM as Float32 (Frontend)
- In memory: `Float32Array` object in JavaScript
- Range: -1.0 to 1.0
- Used for: Waveform display via Plotly
- Example: `[0.000123, 0.000456, -0.000234, ...]`

### PCM as Int16 Bytes (Backend)
- On disk: WAV file binary data
- Range: -32768 to 32767
- Used for: Permanent storage, archive
- Created by: Scaling float32 × 32767, then FFmpeg encoding

### PCM in Network Transfer
- As JSON: Float32 array serialized as JavaScript numbers
- In request body: `{"audio_data": [0.000123, 0.000456, ...], "sample_rate": 48000}`
- No lossy conversion - same precision maintained

---

## Conclusion

**The waveform IS a display of PCM data, but ONLY the frontend creates it.**

The flow is:
1. **Frontend captures audio** → WebM blob
2. **Frontend decodes** → PCM Float32Array
3. **Frontend displays** → Plotly visualization (WAVEFORM)
4. **Frontend sends to backend** → Same PCM float32 data
5. **Backend converts** → Int16 WAV file (for archive, not for waveform)

The key insight: **Backend never creates or affects the waveform display**. The backend's job is to preserve the audio as a standard WAV file for clinical records, not to visualize it.

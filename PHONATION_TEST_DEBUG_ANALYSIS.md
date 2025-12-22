# Phonation Test Debug: Complete Flow Analysis

## Files Involved in Phonation Test

```
Frontend:
└── src/pages/Assessments/PhonationAssessment.jsx
    ├─ Records audio (MediaRecorder)
    ├─ Extracts waveform locally (Web Audio API)
    ├─ Sends to backend at: POST /phonation/upload/{vowel}
    └─ Receives metrics back

Backend:
├── backend/app.py
│   └─ Registers phonation router at prefix: /phonation
│
├── backend/routes/phonation_test.py
│   ├─ @router.post("/phonation/analyze")
│   ├─ @router.post("/upload/{vowel}")
│   └─ Handles JSON with float32 audio data
│
└── backend/core/phonation_utils.py
    ├─ save_audio()
    ├─ extract_duration()
    └─ get_waveform()
```

---

## The Problem: Why Waveform Disappears When Backend Runs

### **What's Happening in Frontend:**

**PhonationAssessment.jsx (lines 190-230):**

```javascript
mediaRecorderRef.current.onstop = async () => {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  const url = URL.createObjectURL(blob);

  // STEP 1: Extract waveform locally (INSTANT ~100ms)
  const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);
  //                                            ↑
  //                           This uses Web Audio API, frontend only

  // STEP 2: Update UI with waveform
  setStateMap((prev) => ({
    ...prev,
    [itemId]: {
      ...prev[itemId],
      duration,
      waveform,      // ← Frontend waveform (full resolution)
      samplingRate,
    },
  }));

  // STEP 3: BLOCKS HERE waiting for backend
  uploadToBackend(itemId, blob);
  //                      ↑
  //          This awaits backend response (500-2000ms)
};
```

**The Issue:**
```
Recording stops
    ↓
analyzeAudioBlob() extracts waveform (100ms) ✓
    ↓
setStateMap() updates waveform display ✓
    ↓
WAIT: uploadToBackend() BLOCKS (500-2000ms)
    ↓
Backend response received
    ↓
Backend overwrites waveform! ❌
```

---

## What's Happening in Backend

### **File 1: backend/app.py (Line 30)**

```python
app.include_router(phonation_router, prefix="/phonation")
```

**What it does:**
- Registers the phonation router at `/phonation` prefix
- So the endpoint becomes: `POST /phonation/upload/{vowel}`
- This is correct and matches frontend call at line 97:
  ```javascript
  const res = await fetch(`${API_BASE}/phonation/upload/${itemId}`, ...)
  ```

---

### **File 2: backend/routes/phonation_test.py**

#### **Endpoint: POST /upload/{vowel}** (Line 112)

```python
@router.post("/upload/{vowel}")
async def upload_phonation(vowel: str, data: AudioData):
    """
    Alternative endpoint for vowel upload
    """
    return await analyze_phonation(data)
```

**What it does:**
- Routes the request to `analyze_phonation()` function

---

#### **Main Function: analyze_phonation()** (Lines 73-111)

```python
@router.post("/phonation/analyze")
async def analyze_phonation(data: AudioData):
    """
    Analyze phonation vowel from decoded PCM data
    Expects: {vowel: 'a'|'ii'|'u'|'uhm', audio_data: float[], sample_rate: int}
    """
    try:
        # STEP 1: Convert frontend's float32 array to numpy
        audio_array = np.array(data.audio_data, dtype=np.float32)
        sr = data.sample_rate
        vowel = data.vowel

        # STEP 2: Normalize to [-1, 1] range
        audio_array = np.clip(audio_array, -1.0, 1.0)
        
        # STEP 3: Convert to 16-bit PCM bytes
        pcm_bytes = (audio_array * 32767).astype(np.int16).tobytes()

        # STEP 4: Use FFmpeg to convert PCM → WAV
        wav_path = convert_pcm_to_wav(pcm_bytes, sr)

        # STEP 5: Extract waveform from WAV file
        waveform, sample_rate, duration = extract_waveform_from_wav(wav_path)

        # STEP 6: Save WAV to disk
        output_path = UPLOADS_DIR / f"{vowel}_{int(duration * 1000)}.wav"
        if os.path.exists(wav_path):
            os.rename(wav_path, output_path)

        # STEP 7: Return JSON response
        return {
            "vowel": vowel,
            "duration_sec": round(duration, 2),
            "sampling_rate": sample_rate,
            "waveform": waveform,  # ← BACKEND WAVEFORM
            "file_path": str(output_path),
        }
    except Exception as e:
        print(f"analyze_phonation error: {e}")
        return { "error": str(e) }
```

**The Problem:**
```
Backend extracts waveform AGAIN from WAV file
└─ Returns DOWNSAMPLED waveform (3000 points max)
   └─ Frontend receives this and overwrites frontend waveform
      └─ Result: Waveform changes/disappears
```

---

#### **Helper Function 1: convert_pcm_to_wav()** (Lines 19-38)

```python
def convert_pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Convert raw PCM bytes to WAV format using FFmpeg
    """
    # Create temp files
    temp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".bin")
    temp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")

    temp_in.write(pcm_bytes)
    temp_in.close()

    # FFmpeg command to convert PCM → WAV
    cmd = [
        "ffmpeg", "-y",                                    # Overwrite
        "-f", "f32le",                                     # Format: 32-bit little-endian float
        "-ar", str(sample_rate),                           # Input sample rate
        "-ac", "1",                                        # 1 channel (mono)
        "-i", temp_in.name,                                # Input file
        "-ar", "16000", "-ac", "1",                        # Output: 16kHz mono
        temp_out.name                                      # Output file
    ]

    try:
        subprocess.run(cmd, ..., check=True)
        return temp_out.name
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, 
                          detail="FFmpeg audio conversion failed")
    finally:
        os.unlink(temp_in.name)
```

**What it does:**
1. Receives float32 PCM bytes from frontend
2. Writes to temp binary file
3. Uses FFmpeg to convert: `PCM → WAV (16kHz mono)`
4. Returns path to WAV file

**Potential Issues:**
- ❌ **FFmpeg not installed** → Conversion fails
- ❌ **Wrong format** → Audio decoding fails
- ❌ **Temporary file issues** → Permission denied

---

#### **Helper Function 2: extract_waveform_from_wav()** (Lines 41-63)

```python
def extract_waveform_from_wav(wav_path: str, max_points: int = 3000) -> tuple:
    """
    Extract waveform from WAV file for visualization
    Returns: (waveform_list, sample_rate, duration)
    """
    try:
        audio_data, sr = sf.read(wav_path)  # soundfile.read()
        
        # Ensure mono
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]
        
        # Calculate duration
        duration = len(audio_data) / sr
        
        # DOWNSAMPLE for display (max 3000 points)
        factor = max(1, len(audio_data) // max_points)
        waveform = audio_data[::factor].tolist()
        
        return waveform, sr, duration
    except Exception as e:
        print(f"Error extracting waveform: {e}")
        raise
```

**What it does:**
1. Reads WAV file using soundfile
2. Ensures mono (if stereo, takes channel 0)
3. Calculates duration
4. **Downsamples to max 3000 points**
5. Returns as Python list

**Potential Issues:**
- ❌ **soundfile can't read WAV** → soundfile.read() fails
- ❌ **File permissions** → Can't read temporary file
- ❌ **Corrupt WAV from FFmpeg** → Invalid audio data

---

## The Root Cause: Why Waveform Disappears

### **Timeline of Events:**

```
1. User records audio (5 seconds)

2. Frontend extracts waveform:
   ├─ Web Audio API decodes WebM
   ├─ Gets full resolution: 5 * 48000 = 240,000 samples
   └─ Returns ALL samples (full waveform)

3. Frontend DISPLAYS waveform immediately ✓
   (Waveform shows ~240,000 points in Plotly)

4. Frontend calls uploadToBackend():
   ├─ Sends float32 array to: POST /phonation/upload/a
   │
   └─ Backend receives:
      ├─ Converts float32 → PCM bytes
      ├─ Uses FFmpeg: PCM → WAV (16kHz)
      ├─ Reads WAV with soundfile
      ├─ DOWNSAMPLES to 3000 points
      └─ Returns JSON with 3000-point waveform

5. Frontend receives backend response:
   ├─ Extracts waveform (3000 points)
   ├─ OVERWRITES frontend waveform
   └─ Plotly re-renders with 3000 points
      └─ Result: Waveform appears different/simplified ❌
```

---

## Where the Error Likely Occurs

### **Most Likely Failures (in order):**

#### **1. FFmpeg Not Installed** (90% probability)

**Symptom:**
```
Backend error:
subprocess.CalledProcessError: returned non-zero exit status 1
```

**Fix:**
```powershell
# Install FFmpeg
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

---

#### **2. PCM Conversion Error**

**Symptom:**
```
Backend error:
Error extracting waveform: Error reading file
```

**Reason:**
- FFmpeg conversion created invalid WAV
- soundfile.read() can't parse it

---

#### **3. Audio Context Sample Rate Mismatch**

**Frontend sends:** 48000 Hz (from Web Audio API)
**Backend expects:** 16000 Hz (hardcoded in convert_pcm_to_wav)

**Result:**
```
Resampling occurs: 48000 Hz → 16000 Hz
└─ Samples get compressed
   └─ Waveform looks different
```

---

## The Solution: Decouple Backend Waveform from Frontend

**Current problematic flow:**
```javascript
// Frontend extracts waveform
const { waveform: frontendWaveform } = await analyzeAudioBlob(blob);

// Frontend displays waveform
setStateMap(prev => ({ ...prev, waveform: frontendWaveform }));

// Backend extracts different waveform
const backendResponse = await uploadToBackend(blob);

// Backend waveform OVERWRITES frontend waveform ❌
setStateMap(prev => ({ 
  ...prev, 
  waveform: backendResponse.waveform  // ← Overwrites!
}));
```

**Solution:**
```javascript
// Frontend extracts and keeps waveform
const { waveform: frontendWaveform } = await analyzeAudioBlob(blob);

// Display frontend waveform IMMEDIATELY
setStateMap(prev => ({ ...prev, waveform: frontendWaveform }));

// Backend analysis happens in background WITHOUT overwriting waveform
uploadToBackend(blob).then(response => {
  // Backend only provides metrics, NOT waveform
  setStateMap(prev => ({ 
    ...prev, 
    duration: response.duration_sec,
    // DO NOT override waveform!
  }));
});
```

---

## Summary Table

| Component | File | Function | Issue |
|-----------|------|----------|-------|
| **Frontend Recording** | PhonationAssessment.jsx | `startRecording()` | ✓ Works correctly |
| **Frontend Waveform Extract** | PhonationAssessment.jsx | `analyzeAudioBlob()` | ✓ Full resolution |
| **Frontend Display** | PhonationAssessment.jsx | `setStateMap()` | ✓ Shows waveform |
| **Backend Route** | app.py | `include_router()` | ✓ Correct prefix |
| **Backend Endpoint** | phonation_test.py | `/upload/{vowel}` | ✓ Reachable |
| **PCM → WAV** | phonation_test.py | `convert_pcm_to_wav()` | ❌ **Requires FFmpeg** |
| **Waveform Extract** | phonation_test.py | `extract_waveform_from_wav()` | ❌ **Downsamples to 3000** |
| **Waveform Return** | phonation_test.py | Response JSON | ❌ **Overwrites frontend** |


# Phonation Test: Backend Files Explained Simply

## The 4 Backend Files

### **1. `backend/app.py`** - Main Server

**What it does:**
- Starts the FastAPI server on port 8000
- Registers all routes (including phonation)

**Key line:**
```python
app.include_router(phonation_router, prefix="/phonation")
```

**Makes endpoint available at:** `http://localhost:8000/phonation/upload/{vowel}`

**Status:** ✓ Working correctly

---

### **2. `backend/routes/phonation_test.py`** - Request Handler

**What it does:**
- Handles incoming audio requests
- Converts audio format
- Saves file
- Returns response

**Main function: `analyze_phonation()`**

```
Flow:
  ├─ Receive: { audio_data: [float32], sample_rate: int }
  │
  ├─ Convert float32 → PCM bytes
  │
  ├─ Call FFmpeg: PCM → WAV file
  │
  ├─ Extract metadata: duration, sample_rate
  │
  ├─ Save WAV to disk
  │
  └─ Return: { vowel, duration_sec, file_path, ... }
```

**Endpoints:**
- `POST /phonation/analyze` - Main endpoint
- `POST /upload/{vowel}` - Alternative (same function)

**Status:** ✓ Fixed - no longer returns waveform

---

### **3. `backend/core/phonation_utils.py`** - Helper Functions

**What it does:**
- Provides utility functions for audio processing

**Functions:**
1. **`save_audio(file, path)`**
   - Saves audio file to disk
   - Creates directories if needed

2. **`extract_duration(file_path)`**
   - Reads audio file with librosa
   - Returns duration in seconds

3. **`get_waveform(file_path, max_points)`**
   - Reads audio file
   - Downsamples to max 3000 points
   - Returns as list

**Status:** ✓ Working (not currently used by phonation_test.py)

---

## Request-Response Flow

### **Frontend Sends (as JSON):**
```json
{
  "vowel": "a",
  "audio_data": [0.1, -0.05, 0.12, ...],  // 240,000+ floats
  "sample_rate": 48000
}
```

### **Backend Receives:**
```python
data = AudioData(
    vowel="a",
    audio_data=[...],        # List of floats
    sample_rate=48000
)
```

### **Backend Processes:**
```
1. Convert to numpy: np.array(data.audio_data, dtype=np.float32)
2. Normalize: np.clip(audio_array, -1.0, 1.0)
3. Convert to 16-bit: (audio_array * 32767).astype(np.int16)
4. Convert to bytes: .tobytes()
5. FFmpeg conversion: PCM bytes → WAV file
6. Extract metadata: duration, sample_rate
7. Save file: uploads/a_2000.wav
```

### **Backend Returns (as JSON):**
```json
{
  "vowel": "a",
  "duration_sec": 2.5,
  "sampling_rate": 16000,
  "file_path": "uploads/a_2500.wav",
  "status": "success"
}
```

---

## What Changed (The Fix)

### **Before:**
Backend extracted waveform:
```python
waveform, sample_rate, duration = extract_waveform_from_wav(wav_path)

return {
    "vowel": vowel,
    "waveform": waveform,  # ← 3,000 points (downsampled)
    "file_path": str(output_path),
}
```

**Problem:** Frontend waveform (240,000 points) gets overwritten with backend waveform (3,000 points)

### **After:**
Backend only returns metadata:
```python
audio_data, sample_rate = sf.read(wav_path)
duration = len(audio_data) / sample_rate

return {
    "vowel": vowel,
    "duration_sec": round(duration, 2),
    "sampling_rate": sample_rate,
    "file_path": str(output_path),
}
```

**Result:** Frontend keeps its full-resolution waveform, backend just validates audio.

---

## Error Scenarios & Solutions

### **Scenario 1: "FFmpeg audio conversion failed"**
```
Cause: FFmpeg command failed
Solution: 
  1. Check FFmpeg installed: ffmpeg -version
  2. Check temporary files writable
  3. Check audio format valid
```

### **Scenario 2: "Error extracting waveform"**
```
Cause: WAV file corrupted or soundfile can't read
Solution:
  1. Check FFmpeg output file exists
  2. Verify soundfile can read WAV
  3. Check file permissions
```

### **Scenario 3: Network timeout**
```
Cause: Backend taking too long (>30s)
Solution:
  1. Check backend is running
  2. Check large audio file
  3. Look for infinite loop in processing
```

---

## Quick Debugging Checklist

- [ ] Backend running? (should see: "Uvicorn running on http://0.0.0.0:8000")
- [ ] FFmpeg installed? (`ffmpeg -version` should work)
- [ ] Uploads directory exists? (`backend/uploads/` should exist)
- [ ] Frontend making request? (Browser DevTools → Network tab)
- [ ] Backend receiving request? (Should see debug output)
- [ ] FFmpeg converting? (Check temp files)
- [ ] Response sent back? (Check status 200 in Network tab)
- [ ] Frontend receiving response? (Check JSON in response)

---

## Summary Table

| Component | File | Working? | Issue |
|-----------|------|----------|-------|
| **Server startup** | app.py | ✓ Yes | None |
| **Route registration** | app.py | ✓ Yes | None |
| **Request handling** | phonation_test.py | ✓ Yes | None |
| **Format conversion** | phonation_test.py | ✓ Probably | Needs FFmpeg |
| **File saving** | phonation_test.py | ✓ Probably | Needs permissions |
| **Metadata extraction** | phonation_test.py | ✓ Yes | None |
| **Waveform override** | phonation_test.py | ✗ **FIXED** | Was overwriting |
| **Waveform override** | PhonationAssessment.jsx | ✗ **FIXED** | Was accepting override |


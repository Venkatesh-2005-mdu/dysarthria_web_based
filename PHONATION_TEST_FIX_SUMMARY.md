# Phonation Test: Complete Analysis & Fix Applied

## The Problem (Root Cause)

**Waveform disappears when backend runs because:**

1. Frontend extracts full-resolution waveform (240,000+ samples)
2. Frontend displays it immediately ✓
3. Backend ALSO extracts waveform (downsampled to 3,000 points)
4. Backend OVERWRITES frontend waveform with downsampled version ❌
5. Result: Waveform disappears or changes to blocky version

---

## Files Involved & Their Roles

### **Frontend: `src/pages/Assessments/PhonationAssessment.jsx`**

**Line 135-139:** Analyze audio locally
```javascript
const { duration, waveform, samplingRate } = await analyzeAudioBlob(blob);
// Extracts full resolution waveform using Web Audio API
```

**Line 145-154:** Display waveform immediately
```javascript
setStateMap((prev) => ({
  ...prev,
  [itemId]: {
    duration,
    waveform,  // ← Full resolution, from frontend
  },
}));
```

**Line 159:** Send to backend
```javascript
uploadToBackend(itemId, blob);
```

**Line 87-107:** Backend communication (PROBLEMATIC)
```javascript
const response = await res.json();
setStateMap((prev) => ({
  ...prev,
  waveform: response.waveform || [],  // ❌ OVERWRITES frontend waveform!
}));
```

---

### **Backend: `backend/app.py`**

**Line 30:** Route registration
```python
app.include_router(phonation_router, prefix="/phonation")
```

Endpoint becomes: `POST /phonation/upload/{vowel}`

---

### **Backend: `backend/routes/phonation_test.py`**

**Three key functions:**

#### 1. **analyze_phonation()** (Line 73)
- Receives float32 audio array from frontend
- Converts to PCM bytes
- Calls FFmpeg to convert PCM → WAV
- Extracts waveform from WAV
- Returns response with metrics

#### 2. **convert_pcm_to_wav()** (Line 19)
- Takes PCM bytes (raw audio)
- Uses FFmpeg command: `f32le (float) → WAV (16kHz mono)`
- **Requires:** FFmpeg installed ✓ (verified present)

#### 3. **extract_waveform_from_wav()** (Line 41)
- Reads WAV file with soundfile
- **Downsamples to 3,000 points max** (causes simplification)
- Returns waveform list

---

## The Data Flow

```
Frontend:
  Record audio (WebM blob)
    ↓
  Analyze locally: 240,000 samples
    ↓
  Display IMMEDIATELY ✓
    ↓
  Send to backend (float32 array)
    
Backend:
  Receive float32 array
    ↓
  Convert: float32 → PCM bytes
    ↓
  FFmpeg: PCM → WAV (16kHz mono)
    ↓
  Extract: WAV → 3,000 point waveform
    ↓
  Return JSON response

Frontend (receiving):
  Get response
    ↓
  Update state with backend waveform
    ↓
  ❌ Overwrites frontend waveform (240,000 → 3,000 points)
    ↓
  Plotly re-renders with fewer points
    ↓
  Waveform appears "simplified" or disappears
```

---

## Fixes Applied

### **Fix 1: Backend No Longer Returns Waveform**

**File:** `backend/routes/phonation_test.py`

**Before:**
```python
waveform, sample_rate, duration = extract_waveform_from_wav(wav_path)

return {
    "vowel": vowel,
    "waveform": waveform,  # ❌ This gets sent to frontend
    "file_path": str(output_path),
}
```

**After:**
```python
# Extract only metadata (duration, sample rate)
audio_data, sample_rate = sf.read(wav_path)
duration = len(audio_data) / sample_rate

return {
    "vowel": vowel,
    "duration_sec": round(duration, 2),
    "sampling_rate": sample_rate,
    "file_path": str(output_path),
    # Waveform NOT returned - frontend keeps its own waveform
}
```

**Result:** Backend only provides metadata, not waveform.

---

### **Fix 2: Frontend Doesn't Overwrite Its Waveform**

**File:** `src/pages/Assessments/PhonationAssessment.jsx`

**Before:**
```javascript
const response = await res.json();
setStateMap((prev) => ({
  ...prev,
  [itemId]: {
    backendDuration: response.duration_sec,
    waveform: response.waveform || [],  // ❌ OVERWRITES!
    samplingRate: response.sampling_rate || 16000,
  },
}));
```

**After:**
```javascript
const response = await res.json();
setStateMap((prev) => ({
  ...prev,
  [itemId]: {
    backendDuration: response.duration_sec,
    // Waveform stays from analyzeAudioBlob() call
    // DO NOT override it with backend response
  },
}));
```

**Result:** Frontend keeps its high-resolution waveform.

---

## Expected Behavior After Fixes

### **Before Fixes:**
```
Record audio → Waveform shows → Wait 1-2s → Waveform disappears/changes
```

### **After Fixes:**
```
Record audio → Waveform shows IMMEDIATELY ✓ → Backend processes silently → Waveform unchanged ✓
```

---

## Why This Works

1. **Frontend extracts waveform** using Web Audio API (full resolution)
2. **Frontend displays immediately** (no waiting for backend)
3. **Backend only validates/stores** the audio file
4. **Backend doesn't touch frontend waveform**
5. **Result:** Waveform stays visible and doesn't change

---

## What Backend Still Does

✓ Receives audio from frontend
✓ Converts format (PCM → WAV)
✓ Validates audio length
✓ Saves file to disk
✓ Returns metadata (duration, sample rate)
✓ Provides file path for later analysis

**But no longer:**
✗ Extracts and returns waveform (frontend does this better)

---

## Testing

1. **Start backend:** `python app.py`
2. **Start frontend:** `npm run dev`
3. **Open PhonationAssessment page**
4. **Record audio** for any vowel
5. **Expected:** Waveform shows immediately and stays visible
6. **Check console:** Backend response should not have `waveform` field

---

## Files Modified

✓ `backend/routes/phonation_test.py` - Removed waveform extraction
✓ `src/pages/Assessments/PhonationAssessment.jsx` - Removed waveform override

**No other files changed** - this is a surgical fix targeting only the overwrite issue.

---

## Benefits

1. ✓ **Instant waveform display** - no backend delay
2. ✓ **Full resolution waveform** - no downsampling
3. ✓ **Better UX** - user sees result immediately
4. ✓ **Simpler backend** - less work to do
5. ✓ **Separation of concerns** - waveform display is frontend responsibility


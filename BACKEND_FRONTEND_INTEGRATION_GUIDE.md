# Backend + Frontend Integration: Running Both Together

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  PHONATION TEST: COMPLETE FLOW                   │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React + Vite)              BACKEND (FastAPI)
Port: 5173                           Port: 8000
────────────────────────────────────────────────────────────────

1. USER OPENS BROWSER
   ├─ http://localhost:5173
   ├─ Loads PhonationAssessment.jsx
   └─ Initializes audio recording UI

2. USER RECORDS AUDIO
   ├─ MediaRecorder captures WebM blob
   ├─ RealtimeAudioCapture extracts live samples
   └─ AnnotatedWaveformCanvas displays LIVE waveform
       (100% FRONTEND - no backend needed yet)

3. USER STOPS RECORDING
   ├─ analyzeAudioBlob() decodes WebM → Float32Array (16kHz)
   ├─ setStateMap updates state with full-resolution waveform
   ├─ Plotly renders complete waveform visualization
   ├─ **WAVEFORM DISPLAYS IMMEDIATELY** (~105ms, frontend-only)
   │
   └─→ MEANWHILE, uploadToBackend() sends data:
       ├─ POST http://localhost:8000/phonation/upload/{vowel}
       ├─ Sends: {vowel, audio_data: [...], sample_rate}
       ├─ Backend converts PCM → WAV via FFmpeg
       ├─ Backend saves to backend/uploads/
       ├─ Backend returns: {duration_sec, sampling_rate, file_path}
       └─→ Frontend receives metrics, display unchanged

RESULT:
✓ Waveform displays instantly (~105ms) - FRONTEND ONLY
✓ Backend processes independently (500-1500ms)
✓ Clinical WAV file saved for records
✓ No blocking or waiting between them
```

---

## Answer: Is Backend/Frontend Working Together?

### YES, but they work in PARALLEL, NOT sequentially:

| Phase | Responsibility | Does It Block? |
|-------|-----------------|----------------|
| **Audio Recording** | Frontend (MediaRecorder) | N/A |
| **Live Waveform** | Frontend (RealtimeAudioCapture) | No |
| **Waveform Display** | Frontend (analyzeAudioBlob + Plotly) | **Immediately displayed** |
| **Backend Upload** | Frontend initiates, Backend processes | **Non-blocking** |
| **WAV Conversion** | Backend (FFmpeg) | Happens in background |
| **Metrics Return** | Backend → Frontend | Updates separately |

---

## How to Run Both at the Same Time

### Step 1: Terminal 1 - Start Frontend (Vite Dev Server)

```powershell
# Navigate to project root
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend"

# Start Vite dev server (port 5173)
npm run dev
```

**Expected output:**
```
  VITE v7.2.4  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

✅ Frontend is now running at `http://localhost:5173`

---

### Step 2: Terminal 2 - Start Backend (FastAPI)

```powershell
# Activate Python virtual environment
& "C:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend_env\Scripts\Activate.ps1"

# Navigate to backend directory
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend"

# Start FastAPI server (port 8000)
python -m uvicorn app:app --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

✅ Backend is now running at `http://localhost:8000`

---

## Verification: Both Servers Running

### Check 1: Open Frontend in Browser
```
http://localhost:5173
↓
You should see the SLP Assessment app
↓
Navigate to Phonation Assessment
↓
Should display recording UI
```

### Check 2: Test Backend Endpoint
Open new PowerShell terminal (keep other two open) and run:

```powershell
# Test backend is responding
Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing | Select-Object StatusCode
```

**Expected response:** `StatusCode : 200`

✅ Backend is accessible

---

## Full Workflow: Recording & Display

### What Happens Step-by-Step:

1. **User opens browser** → `http://localhost:5173`
   - Frontend loads, requests microphone permission
   
2. **User clicks "Start Recording"** on a vowel
   - MediaRecorder starts capturing audio
   - RealtimeAudioCapture gets raw samples
   - Waveform updates LIVE on screen (from RealtimeAudioCapture)
   - Status: Frontend only, no backend involved yet

3. **User speaks for ~2 seconds, clicks "Stop"**
   - WebM blob created from chunks
   - `analyzeAudioBlob()` runs:
     - Decodes WebM → Float32Array (16kHz resampled)
     - Full resolution maintained (no downsampling)
   - `setStateMap()` updates React state
   - Plotly visualizes complete waveform
   - **WAVEFORM VISIBLE ON SCREEN** (~105ms total)
   - Status: Frontend done, waveform displayed

4. **Meanwhile (non-blocking):**
   - `uploadToBackend()` sends audio data to backend
   - POST request goes to `http://localhost:8000/phonation/upload/a`
   - Backend receives audio_data and sample_rate
   - Backend converts PCM float32 → 16-bit int16 bytes
   - FFmpeg converts bytes → WAV file
   - Backend saves: `backend/uploads/a_1734567890.wav`
   - Backend returns: `{duration_sec: 2.1, sampling_rate: 16000, ...}`

5. **Frontend receives backend response**
   - Updates `backendDuration` state
   - Waveform stays unchanged (wasn't affected by backend)
   - UI shows: "Duration: 2.1s" (from backend)

**Result:** Perfect waveform display + permanent WAV file saved

---

## Diagram: Request Flow

```
BROWSER (localhost:5173)
│
├─ PhonationAssessment.jsx initialized
│  └─ Ready to record
│
├─ User clicks "Record"
│  └─ MediaRecorder + RealtimeAudioCapture active
│     └─ Live waveform updating on screen
│
├─ User clicks "Stop"
│  ├─ WebM blob created
│  ├─ analyzeAudioBlob() → Float32Array (16kHz)
│  ├─ setStateMap() → React re-render
│  ├─ Plotly renders → WAVEFORM VISIBLE
│  │
│  └─ uploadToBackend() → POST request to backend
│     │
│     ├──→ http://localhost:8000/phonation/upload/a
│     │   ├─ Backend receives: {vowel, audio_data, sample_rate}
│     │   ├─ Converts: float32 PCM → int16 bytes → WAV
│     │   ├─ Saves: backend/uploads/a_timestamp.wav
│     │   └─ Returns: {duration_sec, sampling_rate, file_path}
│     │
│     └──→ Frontend gets response
│         └─ Updates backendDuration only
│            (waveform untouched)
```

---

## Troubleshooting

### Frontend running, backend won't start?

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Fix:**
```powershell
# Make sure venv is activated
& "C:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend_env\Scripts\Activate.ps1"

# Install requirements
pip install -r requirements.txt

# Then try again
python -m uvicorn app:app --reload
```

---

### Backend running, frontend can't connect?

**Symptoms:** Recording works, waveform displays, but "Duration" never shows

**Causes & Fixes:**

1. **Backend not actually running**
   - Check Terminal 2 shows `Uvicorn running on http://127.0.0.1:8000`
   - If not: Run backend command again

2. **CORS issue** (unlikely, but check)
   - Open browser DevTools → Network tab
   - Click "Stop Recording"
   - Should see POST request to `http://localhost:8000/phonation/upload/a`
   - Check Response tab for error

3. **Backend error during processing**
   - Check Terminal 2 output for error messages
   - Common: FFmpeg conversion failed
   - Check: Is FFmpeg installed? (`ffmpeg -version`)

4. **Port already in use**
   - Backend on 8000: `netstat -ano | findstr :8000`
   - Frontend on 5173: `netstat -ano | findstr :5173`
   - Kill process if needed: `taskkill /PID <pid> /F`

---

### Test the Backend Manually

Use the test script you have:

```powershell
# Terminal 2 (with venv activated)
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend"

python test_phonation.py
```

**Expected output:**
```
[DEBUG] Generated test audio:
  Sample rate: 48000 Hz
  Duration: 2.0 s
  Total samples: 96000
  First 10 samples: [0.0, 0.00383..., ...]

[DEBUG] Calling analyze_phonation()...
[DEBUG] ✓ Success! Backend returned:
{
  "vowel": "a",
  "duration_sec": 2.0,
  "sampling_rate": 16000,
  "file_path": "uploads/a_2000.wav",
  "status": "success"
}
```

✅ Backend is working

---

## Quick Reference: Two-Terminal Setup

### Terminal 1 (Frontend)
```powershell
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend"
npm run dev
# Wait for: "Local: http://localhost:5173/"
```

### Terminal 2 (Backend)
```powershell
& "C:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend_env\Scripts\Activate.ps1"
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend"
python -m uvicorn app:app --reload
# Wait for: "Uvicorn running on http://127.0.0.1:8000"
```

### Terminal 3 (Testing)
```powershell
# Optional - use to run test_phonation.py or check ports
```

---

## Summary: Architecture

| Component | Port | Language | Purpose |
|-----------|------|----------|---------|
| Frontend (Vite) | 5173 | JavaScript/React | UI, recording, waveform display |
| Backend (FastAPI) | 8000 | Python | Audio processing, WAV storage |
| Browser | N/A | N/A | Displays http://localhost:5173 |

**Communication:** Frontend at 5173 makes HTTP requests to Backend at 8000

**Waveform Display:** 100% Frontend (Web Audio API)  
**Waveform Does NOT Depend On:** Backend success/failure

**Files Created:** Only if backend succeeds (backend/uploads/*.wav)

---

## Answer to Your Question

**"Is backend and frontend working together to display waveform?"**

**Detailed Answer:**

- **NO for waveform display** - Waveform is 100% frontend (Web Audio API + Plotly)
- **YES for overall workflow** - Frontend records, displays immediately, then sends to backend
- **They work in PARALLEL** - Waveform displays while backend processes independently
- **They're LOOSELY COUPLED** - Frontend doesn't wait for backend, backend doesn't affect display

**The key insight:** Backend archival (WAV save) is separate from frontend visualization (waveform display). You see the waveform instantly because the frontend doesn't depend on the backend.


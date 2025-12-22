# Running Backend & Frontend Together

## Quick Start (2 Terminals)

### **Terminal 1: Frontend (Vite Development Server)**

```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend
npm run dev
```

**Expected output:**
```
  VITE v7.2.4  ready in 245 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

Then open browser: **http://localhost:5173**

---

### **Terminal 2: Backend (FastAPI Server)**

```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend
# Activate virtual environment
..\backend_env\Scripts\Activate.ps1

# Run backend
python app.py
```

**Expected output:**
```
[DEBUG] Resonance analysis started...
INFO:     Uvicorn running on http://0.0.0.0:8000 [Press ENTER to quit]
```

Backend runs at: **http://localhost:8000**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Your Browser                       │
│           http://localhost:5173                     │
└─────────────────────┬───────────────────────────────┘
                      │
              (HTTP requests)
                      │
         ┌────────────┴────────────┐
         │                         │
    Frontend                   Backend
    Vite Dev Server           FastAPI Server
    Port: 5173                Port: 8000
    (React + JSX)             (Python)
         │                         │
         │                         │
    Bundles React            Processes audio
    + components             + LPC analysis
    + pages                  + Returns JSON
         │                         │
         └────────────┬────────────┘
                      │
         (Audio analysis results)
                      │
              Display metrics
```

---

## Detailed Setup Steps

### **Step 1: Frontend Setup (One-time)**

```powershell
# Navigate to project root
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend

# Install dependencies (if not already done)
npm install

# Verify Vite is working
npm run dev
```

---

### **Step 2: Backend Setup (One-time)**

```powershell
# Navigate to project root
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend

# Create virtual environment (if not already done)
python -m venv backend_env

# Activate virtual environment
backend_env\Scripts\Activate.ps1

# Install Python dependencies
pip install -r backend/requirements.txt
```

**If you get an activation error:**
```powershell
# Try this instead
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
backend_env\Scripts\Activate.ps1
```

---

### **Step 3: Run Both Servers**

**Terminal 1 (Frontend):**
```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend
npm run dev
```

Wait for: `Local:   http://localhost:5173/`

**Terminal 2 (Backend):**
```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend
backend_env\Scripts\Activate.ps1
cd backend
python app.py
```

Wait for: `Uvicorn running on http://0.0.0.0:8000`

---

## How Frontend & Backend Communicate

### **Frontend Code (RessonanceAndArticulationAssessment.jsx):**

```javascript
const API_BASE = "http://localhost:8000";

// Frontend sends audio to backend
const response = await fetch(`${API_BASE}/api/analyze/resonance/analyze`, {
  method: "POST",
  body: formData  // Audio file
});

const result = await response.json();  // Get metrics back
```

### **Request Flow:**

```
1. User records audio in browser
         │
         ↓
2. Frontend extracts waveform (Web Audio API)
         │
         ↓
3. Frontend displays waveform IMMEDIATELY
         │
         ↓
4. Frontend sends audio blob to: http://localhost:8000/api/analyze/resonance/analyze
         │
         ↓
5. Backend receives WebM file
         │
         ↓
6. Backend loads with librosa + performs LPC analysis
         │
         ↓
7. Backend returns JSON: { a1_frequency, p0_frequency, nasality_ratio, spectrogram, ... }
         │
         ↓
8. Frontend receives metrics
         │
         ↓
9. Frontend displays metrics + spectrogram
```

---

## API Endpoints Available

### **Resonance Analysis**
```
POST http://localhost:8000/api/analyze/resonance/analyze
Input: WebM audio file
Output: A1/P0 frequencies, nasality ratio, classification, spectrogram
```

### **AMR (Alternating Motion Rate)**
```
POST http://localhost:8000/api/analyze/amr?sound=pa
Input: JSON { audio_data: [...], sample_rate: 16000 }
Output: Duration, repetition count, waveform
```

### **SMR (Sequential Motion Rate)**
```
POST http://localhost:8000/api/analyze/smr
Input: JSON { audio_data: [...], sample_rate: 16000 }
Output: Duration, transition quality, waveform
```

---

## Troubleshooting

### **"Address already in use" on Port 8000**

Backend is already running or another app is using it.

**Solution:**
```powershell
# Kill the process using port 8000
netstat -ano | findstr :8000
# Find the PID from output, then:
taskkill /PID <PID> /F

# Or change backend port in backend/app.py
# Change: uvicorn.run(app, host="0.0.0.0", port=8000)
# To:     uvicorn.run(app, host="0.0.0.0", port=8001)
# Then update API_BASE in frontend
```

---

### **"Address already in use" on Port 5173**

Frontend server already running.

**Solution:**
```powershell
# Kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or run on different port
npm run dev -- --port 5174
```

---

### **Backend Module Not Found Error**

```
ModuleNotFoundError: No module named 'librosa'
```

**Solution:**
```powershell
# Make sure virtual environment is ACTIVATED
backend_env\Scripts\Activate.ps1

# Reinstall requirements
pip install -r backend/requirements.txt
```

---

### **Frontend Can't Connect to Backend**

Browser console shows:
```
Failed to fetch: http://localhost:8000/...
```

**Solutions:**
1. **Check if backend is running:**
   ```powershell
   # In browser, visit http://localhost:8000/docs
   # Should show FastAPI docs
   ```

2. **Check CORS is enabled:**
   - Backend should have: `allow_origins=["*"]` (it does in app.py)

3. **Check port is correct:**
   - Frontend should use: `const API_BASE = "http://localhost:8000";`
   - Located in: `src/pages/Assessments/RessonanceAndArticulationAssessment.jsx` (line ~12)

---

### **Python Dependencies Won't Install**

```powershell
# Upgrade pip first
python -m pip install --upgrade pip

# Then install requirements
pip install -r backend/requirements.txt

# If scipy fails, install wheel first
pip install wheel
pip install -r backend/requirements.txt
```

---

## Testing the Connection

### **Test Backend is Working:**

Open browser and visit:
```
http://localhost:8000/docs
```

You should see FastAPI interactive documentation with all endpoints listed.

### **Test Frontend Can Reach Backend:**

Open browser DevTools (F12) → Console → Run:
```javascript
fetch('http://localhost:8000/docs')
  .then(r => r.text())
  .then(t => console.log('✓ Backend is reachable'))
  .catch(e => console.error('✗ Backend error:', e))
```

Should print: `✓ Backend is reachable`

---

## Environment Variables (Optional)

If you want to change the backend port, edit `backend/app.py`:

```python
if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000  # Change this to any port
    )
```

Then update frontend `API_BASE`:

```javascript
// In RessonanceAndArticulationAssessment.jsx
const API_BASE = "http://localhost:YOUR_PORT";
```

---

## File Structure Reference

```
slp-assessment-frontend/
├── src/
│   ├── pages/Assessments/
│   │   └── RessonanceAndArticulationAssessment.jsx  (API calls here)
│   ├── components/
│   └── ...
│
├── backend/
│   ├── app.py                    (Backend entry point)
│   ├── requirements.txt          (Python dependencies)
│   ├── core/
│   │   ├── resonance_utils.py   (LPC analysis)
│   │   └── ...
│   ├── routes/
│   │   ├── resonance_analysis.py (Endpoint handler)
│   │   ├── process_pataka.py     (AMR/SMR handler)
│   │   └── ...
│   └── uploads/                 (Temp audio files)
│
├── package.json                 (Frontend dependencies)
└── backend_env/                 (Virtual environment)
```

---

## Quick Reference Commands

### **Start Everything:**

**Terminal 1:**
```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend
npm run dev
```

**Terminal 2:**
```powershell
cd c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend
..\backend_env\Scripts\Activate.ps1
python app.py
```

### **Stop Everything:**
- Terminal 1: `Ctrl+C`
- Terminal 2: `Ctrl+C`

### **Check if Running:**

```powershell
# Frontend
netstat -ano | findstr :5173

# Backend
netstat -ano | findstr :8000
```

---

## Expected Behavior After Setup

1. **Open http://localhost:5173** in browser
2. Navigate to RessonanceAndArticulationAssessment page
3. Record audio for resonance/AMR/SMR
4. **Waveform displays immediately** (frontend only)
5. **~1-2 seconds later:** Metrics appear (backend completes)
6. View clinical results, spectrogram, classification

If metrics don't appear → check if backend is running and no errors in console


# LPC Backend Analysis - Complete Technical Breakdown

## Files Involved

```
backend/
├── app.py                          # FastAPI app setup, route registration
├── routes/
│   └── resonance_analysis.py       # HTTP endpoint, handles uploads
└── core/
    └── resonance_utils.py          # LPC computation core logic
```

---

## File-by-File Breakdown

### 1. `backend/app.py` (Route Registration)

```python
from backend.routes.resonance_analysis import router as resonance_router

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# Register the resonance route
app.include_router(resonance_router, prefix="/api/analyze")
```

**Result:** Makes endpoint available at `POST /api/analyze/resonance/analyze`

---

### 2. `backend/routes/resonance_analysis.py` (HTTP Handler)

**Location:** [backend/routes/resonance_analysis.py](backend/routes/resonance_analysis.py)

**Main Endpoint:**
```python
@router.post("/resonance/analyze")
async def analyze_resonance_audio(
    audio: UploadFile = File(...),           # WebM blob from frontend
    vowel: str = Query("o", ...)             # Vowel being tested
):
```

**Request Flow:**
```
Frontend sends: POST /api/analyze/resonance/analyze
                with: audio file (WebM) + vowel (query param)
    ↓
    ↓ 1. SAVE FILE
    ├─ filename = f"resonance_{vowel}_{audio.filename}"
    ├─ filepath = uploads/resonance/ + filename
    └─ Write to disk
    
    ↓ 2. LOAD & RESAMPLE WITH LIBROSA
    ├─ y, sr = librosa.load(filepath, sr=44100, mono=True)
    ├─ y = audio waveform (array of float samples)
    ├─ sr = sample rate (forced to 44100 Hz)
    └─ mono=True → single channel (combine stereo if needed)
    
    ↓ 3. TRIM SILENCE
    ├─ y_trimmed, _ = librosa.effects.trim(y, top_db=30)
    ├─ Removes quiet parts (below -30dB threshold)
    └─ Improves peak detection
    
    ↓ 4. VALIDATE LENGTH
    ├─ if len(y_trimmed) < 2 * sr (88,200 samples):
    │  └─ Return error: "Audio too short. Minimum 2 seconds required."
    └─ Ensures sufficient data for analysis
    
    ↓ 5. COMPUTE LPC METRICS
    └─ resonance_metrics = calculate_resonance_metrics(y_trimmed, sr=44100)
    
    ↓ 6. GENERATE SPECTROGRAM
    └─ spectrogram_data = generate_spectrogram(y_trimmed, sr=44100)
    
    ↓ 7. COMBINE RESULTS
    └─ result = {
         "vowel": "o",
         "sampling_rate": 44100,
         "duration": 2.5,
         ...metrics...,
         "spectrogram": [...],
         "spectrogram_frequencies": [...],
         "spectrogram_times": [...]
       }
    
    ↓
    ↓ 8. RETURN JSON
    └─ return JSONResponse(content=result)
```

---

### 3. `backend/core/resonance_utils.py` (LPC Core Logic)

This file contains the actual signal processing. Let's trace through it step-by-step:

#### **STEP 1: Pre-emphasis Filtering**

**Function:** `apply_preemphasis(audio, coef=0.97)`

```python
def apply_preemphasis(audio: np.ndarray, coef: float = 0.97) -> np.ndarray:
    emphasized = np.zeros_like(audio)
    emphasized[0] = audio[0]
    for n in range(1, len(audio)):
        emphasized[n] = audio[n] - coef * audio[n - 1]
    return emphasized
```

**What it does:**
- Compensates for natural speech spectral tilt (higher frequencies decay at ~6 dB/octave)
- Formula: `y(n) = x(n) - 0.97 * x(n-1)`
- Boosts high frequencies so LPC can better capture formant peaks

**Example:**
```
Original audio:   [0.1,  0.2,  -0.15,  0.3, ...]
Pre-emphasized:   [0.1, 0.13, -0.344, 0.45, ...]
                    ↑    ↑      ↑       ↑
                    |    |      |       └─ Enhanced difference
                    └─ Kept as-is
```

**Input:** Normalized audio (-1.0 to 1.0)
**Output:** Pre-emphasized signal (also -1.0 to 1.0 range)

---

#### **STEP 2: Frame-Based Analysis**

**Within:** `calculate_resonance_metrics(audio, sr=44100)`

```python
# Frame-based analysis (25ms frames with Gaussian window)
frame_size = int(0.025 * sr)  # 25ms window
hop_size = int(0.010 * sr)    # 10ms hop (50% overlap)
window = get_window('gaussian', frame_size, fftbins=False)

# At 44100 Hz:
# frame_size = 1102 samples
# hop_size = 441 samples
```

**Visualization:**
```
Audio waveform: [------1102 samples------][------1102 samples------]...
Frame 0:        [------1102 samples------|] (Gaussian window applied)
Frame 1:                  [------1102 samples------|]
Frame 2:                            [------1102 samples------|]
...
10 frames total analyzed (avg ~100ms of audio)
```

**Why Gaussian window?**
- Smoothly tapers frame boundaries to 0
- Prevents spectral leakage artifacts from discontinuities
- Better for spectral analysis than rectangular window

```python
for i in range(min(n_frames, 10)):  # Max 10 frames
    start = i * hop_size
    end = start + frame_size
    frame = emphasized[start:end] * window  # Apply window
    
    # Process this frame through LPC
    lpc_coeffs = compute_lpc_coefficients(frame, sr=sr)
    spectrum = lpc_to_spectrum(lpc_coeffs, fft_size=2048)
    
    # Accumulate spectrum
    if averaged_spectrum is None:
        averaged_spectrum = spectrum
    else:
        averaged_spectrum += spectrum

# Average across all frames
averaged_spectrum /= min(n_frames, 10)
```

**Result:** One averaged spectrum representing the 100ms window

---

#### **STEP 3: LPC Coefficient Computation**

**Function:** `compute_lpc_coefficients(audio, order=14, sr=44100)`

```python
def compute_lpc_coefficients(audio: np.ndarray, order: int = 14, sr: int = 44100) -> np.ndarray:
    # Adaptive order based on sample rate
    if sr < 22000:
        order = 10
    elif sr < 32000:
        order = 12
    elif sr < 48000:        # ← Our case: 44100 Hz
        order = 14
    else:
        order = 16
    
    coeffs = signal.lpc(audio, order)  # Use scipy's LPC (Burg's method)
    return coeffs
```

**What is LPC?**

LPC models the vocal tract as an **all-pole filter**:

```
Audio Signal → Vocal Tract Filter → Output
               (represented by LPC coefficients)
```

The LPC model assumes:
```
x(n) = Σ[a_i * x(n-i)] + error(n)
       i=1 to order

Where:
- a_i = LPC coefficients (a1, a2, ..., a14)
- x(n) = current sample
- x(n-i) = previous samples
```

**Burg's Method:**
- Minimizes forward + backward prediction error
- Guaranteed stable (poles inside unit circle)
- Better spectral estimation than Yule-Walker

**Output:** Array of 15 coefficients (a0, a1, ..., a14)
```python
coeffs = array([1.0, -0.45, 0.23, -0.12, 0.08, -0.06, 0.04, ...])
```

**At 44.1 kHz, order 14:**
- Captures ~7-8 formants (each formant needs ~2 poles)
- Nyquist frequency: 22050 Hz
- Adequate for speech analysis (formants typically < 8 kHz)

---

#### **STEP 4: Convert LPC Coefficients to Spectrum**

**Function:** `lpc_to_spectrum(lpc_coeffs, fft_size=2048)`

```python
def lpc_to_spectrum(lpc_coeffs: np.ndarray, fft_size: int = 2048) -> np.ndarray:
    numerator = [1]              # All-pole filter
    denominator = lpc_coeffs     # a0, a1, ..., a14
    
    # Compute frequency response H(e^jw)
    w, h = signal.freqz(numerator, denominator, worN=fft_size)
    
    # Convert to dB magnitude
    magnitude = np.abs(h)
    magnitude_db = 20 * np.log10(magnitude + 1e-10)
    
    return magnitude_db  # Shape: (2048,)
```

**What happens:**

1. **Create transfer function:**
   ```
   H(z) = 1 / (a0 + a1*z^-1 + a2*z^-2 + ... + a14*z^-14)
   ```

2. **Evaluate on unit circle:**
   ```
   H(e^jw) = frequency response at 2048 points
   ```

3. **Magnitude response:**
   ```
   |H(e^jw)| = spectral envelope (shows formant peaks)
   ```

4. **dB conversion:**
   ```
   20*log10(|H|) ≈ -10 dB = 0.316 linear magnitude
   ```

**Result:** Array of 2048 dB values
- Index 0: 0 Hz
- Index 1024: 22050 Hz (Nyquist)
- Indices correspond to: freq_Hz = index * (44100 / 2048)

**Example peak at index 350:**
```
Frequency = 350 * (44100 / 2048) ≈ 7512 Hz
Magnitude = 5.3 dB (height above noise floor)
```

---

#### **STEP 5: Smooth and Extract Peaks**

**Function:** `extract_spectral_peaks(spectrum, sr=44100, num_peaks=5)`

```python
# 1. SMOOTH THE SPECTRUM
smoothed = signal.savgol_filter(spectrum, window_length=51, polyorder=3)
```

**Savitzky-Golay Filter:**
- Polynomial smoothing (order 3 ≈ cubic)
- Window of 51 points (≈ 1 kHz bandwidth at 44.1kHz)
- Preserves peak shapes better than moving average

**Before smoothing:**
```
      ▲ dB
      │     ╱╲         ╱╲        ╱╲    noise
      │    ╱  ╲       ╱  ╲      ╱  ╲   ^^^^^
      │───┼────╲─────╱────╲────╱────╲──
      │   0    500   1000  1500  2000 Hz
```

**After smoothing:**
```
      ▲ dB
      │     ╱╲         ╱╲        ╱╲
      │    ╱  ╲       ╱  ╲      ╱  ╲
      │───┼────╲─────╱────╲────╱────╲──
      │   0    500   1000  1500  2000 Hz
```

```python
# 2. FIND PEAKS
peaks, properties = signal.find_peaks(smoothed, height=None, distance=20)
```

**Parameters:**
- `height=None`: Any peak above 0 (no minimum height)
- `distance=20`: Peaks must be 20 indices apart (≈ 430 Hz separation)

**Result:** Array of peak indices
```python
peaks = array([237, 412, 687, 1023, 1456])  # 5 peaks found
```

```python
# 3. SORT BY MAGNITUDE & GET TOP 5
peak_magnitudes = smoothed[peaks]  # [5.2, 3.8, 2.1, 4.3, 1.9]
sorted_indices = np.argsort(-peak_magnitudes)[:5]  # Sort descending, take 5
```

**Sorted peaks (by height):**
```
Peak 0: index 237  → 5.2 dB
Peak 1: index 1023 → 4.3 dB
Peak 2: index 412  → 3.8 dB
Peak 3: index 687  → 2.1 dB
Peak 4: index 1456 → 1.9 dB
```

```python
# 4. CONVERT BIN INDICES TO FREQUENCIES
fft_size = len(spectrum)  # 2048
frequencies = (freq_bins / fft_size) * sr

# Example:
# freq_bins = [237, 1023, 412, 687, 1456]
# frequencies = [237/2048*44100, 1023/2048*44100, ...] Hz
#             = [5100, 22100, 8900, 14800, 31400] Hz
# (Last two are above Nyquist - clipped or ignored)
```

**Result:** List of (frequency_Hz, magnitude_dB) tuples
```python
[
    (5100, 5.2),
    (22100, 4.3),  # Possibly aliased
    (8900, 3.8),
    (14800, 2.1),
    (31400, 1.9)   # Definitely aliased
]
```

---

#### **STEP 6: Identify A1 (Oral) and P0 (Nasal)**

**Within:** `calculate_resonance_metrics()`

```python
# Get first 2 peaks
peaks = extract_spectral_peaks(averaged_spectrum, sr=sr, num_peaks=5)

a1_freq, a1_mag = peaks[0] if len(peaks) > 0 else (500, -10)
p0_freq, p0_mag = peaks[1] if len(peaks) > 1 else (350, -15)

# Ensure P0 is lower frequency (nasal cavity resonance)
if p0_freq > a1_freq:
    p0_freq, p0_mag = a1_freq, a1_mag
    a1_freq, a1_mag = peaks[1] if len(peaks) > 1 else (500, -10)
```

**Clinical Context:**

| Formant | Frequency | Meaning |
|---------|-----------|---------|
| **A1** | 500-900 Hz | Oral/velar resonance (1st formant) |
| **P0** | 300-500 Hz | Nasal cavity resonance (nasal pole) |

**The key metric:**
```
A1 - P0 difference (dB)

Normal oral resonance:     A1 >> P0  (e.g., 5.2 dB - 1.5 dB = 3.7 dB diff)
Hypernasality:            A1 ≈ P0   (e.g., 3.5 dB - 3.1 dB = 0.4 dB diff)
```

---

#### **STEP 7: Calculate Nasality Ratio**

**Function:** `calculate_nasality_ratio(spectrum, sr=44100)`

```python
def calculate_nasality_ratio(spectrum: np.ndarray, sr: int = 44100) -> float:
    fft_size = len(spectrum)  # 2048
    
    # Convert dB to linear scale (inverse of 20*log10)
    spectrum_linear = 10 ** (spectrum / 20)
    
    # Find bin indices for frequency bands
    nasal_start_bin = int((300 / sr) * fft_size)   # 300 Hz
    nasal_end_bin = int((700 / sr) * fft_size)     # 700 Hz
    
    oral_start_bin = int((700 / sr) * fft_size)    # 700 Hz
    oral_end_bin = int((5000 / sr) * fft_size)     # 5000 Hz
    
    # At 44.1 kHz with 2048-point FFT:
    # 300 Hz   → bin 14
    # 700 Hz   → bin 32
    # 5000 Hz  → bin 232
    
    # Calculate energy in each band
    nasal_energy = np.sum(spectrum_linear[14:32])
    oral_energy = np.sum(spectrum_linear[32:232])
    
    # Nasality percentage
    total_energy = nasal_energy + oral_energy
    nasality_percentage = (nasal_energy / total_energy) * 100
    
    return min(100, max(0, nasality_percentage))  # Clamp 0-100
```

**Energy calculation:**
```
Nasal band (300-700 Hz):
├─ Represents nasal cavity resonance
└─ Prominent when velopharyngeal port open

Oral band (700-5000 Hz):
├─ Represents oral/pharyngeal resonances
└─ Dominant in normal speech

Nasality% = Nasal_Energy / (Nasal_Energy + Oral_Energy) * 100
```

**Clinical thresholds:**
```
Normal:          20-30%
Mildly nasal:    30-40%
Moderately nasal: 40-50%
Severely nasal:  > 50%
```

---

#### **STEP 8: Classification**

**Function:** `classify_resonance(a1_p0_diff, nasality_ratio)`

```python
def classify_resonance(a1_p0_diff: float, nasality_ratio: float) -> Dict:
    if a1_p0_diff > 10 and nasality_ratio < 15:
        status = "Normal"
        recommendation = "Oral resonance is dominant..."
    
    elif a1_p0_diff < 5 and nasality_ratio > 30:
        status = "Hypernasality"
        recommendation = "Excessive nasal resonance detected..."
    
    elif a1_p0_diff > 10 and nasality_ratio < 5:
        status = "Hyponasality"
        recommendation = "Nasal resonance is suppressed..."
    
    # ... more classifications ...
    
    return {
        "status": status,
        "severity": severity,
        "recommendation": recommendation
    }
```

**Decision matrix:**
```
         A1-P0 dB
              <5        5-8        8-10       >10
         ┌────────┬──────────┬──────────┬────────┐
Nasal%   │        │          │          │        │
<15%     │ Hypo-  │ Oral     │ Normal   │ Normal │
         │ nasal  │ Dominant │          │        │
         ├────────┼──────────┼──────────┼────────┤
15-30%   │ Hyper- │ Mildly   │ Mildly   │ Normal │
         │ nasal  │ Hyper    │ Hyper    │        │
         ├────────┼──────────┼──────────┼────────┤
>30%     │ Severe │ Moderate │ Mild     │ Mildly │
         │ Hyper  │ Hyper    │ Hyper    │ Hyper  │
         └────────┴──────────┴──────────┴────────┘
```

---

#### **STEP 9: Generate Spectrogram for Visualization**

**Function:** `generate_spectrogram(audio, sr=44100, n_fft=2048, hop_length=512)`

```python
def generate_spectrogram(audio: np.ndarray, sr: int = 44100, 
                        n_fft: int = 2048, hop_length: int = 512) -> Dict:
    # STFT: Short-Time Fourier Transform
    D = librosa.stft(audio, n_fft=2048, hop_length=512, window='hamming')
    # D shape: (1025, num_frames)
    # 1025 = (2048 / 2) + 1 (positive frequencies)
    
    # Convert to dB scale
    S = np.abs(D)
    S_db = librosa.power_to_db(S ** 2, ref=np.max)
    
    # Get time and frequency axes
    times = librosa.frames_to_time(np.arange(S_db.shape[1]), sr=sr, hop_length=512)
    frequencies = librosa.fft_frequencies(sr=sr, n_fft=2048)
    
    # Limit to 0-5000 Hz (clinical range)
    max_freq_idx = np.where(frequencies <= 5000)[0]
    S_db_limited = S_db[max_freq_idx, :]
    frequencies_limited = frequencies[max_freq_idx]
    
    return {
        "spectrogram": S_db_limited.tolist(),           # 2D array
        "frequencies": frequencies_limited.tolist(),    # Frequency axis
        "times": times.tolist()                         # Time axis
    }
```

**Spectrogram visualization:**
```
Frequency (Hz)
5000 ┌─────────────────────────────────┐
     │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Darker = higher energy
3000 │ ░░▓▓▓▓░░░▓▓▓░░░░░░░▓▓▓░░░░░░ │
1000 │ ░░▓▓▓▓▓▓░░▓▓▓▓░░░▓▓▓▓▓▓░░░░░ │
     │ ░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ │
   0 └─────────────────────────────────┘
     0              1              2
          Time (seconds)
```

---

## Complete Data Flow Diagram

```
FRONTEND
    │
    ├─ Records audio (WebM blob)
    │
    ├─ Extracts waveform locally (Web Audio API)
    │
    └─→ Sends: POST /api/analyze/resonance/analyze
              (audio blob + vowel type)

BACKEND: resonance_analysis.py
    │
    ├─→ Receives UploadFile
    │
    ├─→ Save to disk: uploads/resonance/resonance_o_*.webm
    │
    ├─→ Load & resample: librosa.load(sr=44100)
    │
    ├─→ Trim silence: librosa.effects.trim()
    │
    ├─→ Validate: length >= 2 seconds
    │
    ├─→ Call: calculate_resonance_metrics()
    │                    │
    │                    ├─ apply_preemphasis()
    │                    │
    │                    ├─ FOR i in range(10):  # Frame loop
    │                    │  ├─ extract frame (25ms)
    │                    │  ├─ compute_lpc_coefficients()
    │                    │  │           │
    │                    │  │           └─→ scipy.signal.lpc()
    │                    │  │               (Burg's method, order 14)
    │                    │  │
    │                    │  ├─ lpc_to_spectrum()
    │                    │  │    └─→ scipy.signal.freqz()
    │                    │  │        (Convert LPC → magnitude spectrum)
    │                    │  │
    │                    │  └─ Accumulate spectrum
    │                    │
    │                    ├─ Average spectrum across frames
    │                    │
    │                    ├─ extract_spectral_peaks()
    │                    │    ├─→ savgol_filter() (smooth)
    │                    │    ├─→ scipy.signal.find_peaks()
    │                    │    └─→ Sort by magnitude, get top 5
    │                    │
    │                    ├─ Identify A1 & P0 from peaks
    │                    │
    │                    ├─ Calculate: a1_p0_diff = a1_mag - p0_mag
    │                    │
    │                    ├─ calculate_nasality_ratio()
    │                    │    └─→ Energy in 300-700 Hz / 0-5000 Hz
    │                    │
    │                    └─ classify_resonance()
    │                         └─→ Decision tree based on metrics
    │
    ├─→ Call: generate_spectrogram()
    │              └─→ librosa.stft()
    │                  (Time-frequency decomposition)
    │
    ├─→ Build response JSON
    │
    └─→ Return to frontend

FRONTEND
    │
    └─→ Receive JSON with:
        ├─ a1_frequency, a1_magnitude
        ├─ p0_frequency, p0_magnitude
        ├─ a1_p0_difference (KEY METRIC)
        ├─ nasality_ratio
        ├─ classification
        ├─ spectrogram (2D array for Plotly)
        └─ ... display results ...
```

---

## Key Parameters Summary

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Sample Rate** | 44100 Hz | Standardized for speech analysis |
| **Frame Size** | 1102 samples (25ms) | Captures stable spectral window |
| **Hop Size** | 441 samples (10ms) | 50% overlap for smooth transitions |
| **LPC Order** | 14 | Captures ~8 formants (for 44.1 kHz) |
| **FFT Size** | 2048 | Frequency resolution: 44100/2048 ≈ 21.5 Hz/bin |
| **Peak Distance** | 20 bins | ~430 Hz minimum peak separation |
| **Window Function** | Gaussian | Minimizes spectral leakage |
| **Num Frames** | 10 | ~100ms window for averaging |
| **Nasal Band** | 300-700 Hz | Nasal cavity resonance |
| **Oral Band** | 700-5000 Hz | Oral tract resonances |
| **Max Peaks** | 5 | Extract top 5 spectral peaks |

---

## Error Handling

```python
# In resonance_analysis.py
try:
    # All processing steps
    ...
except Exception as e:
    return JSONResponse(
        status_code=500,
        content={"error": f"Analysis failed: {str(e)}"}
    )

# Common errors:
# - "Audio too short. Minimum 2 seconds required."
# - "Audio loading failed: [librosa error]"
# - "LPC computation error: [scipy error]"
```

All errors are logged with traceback for debugging.


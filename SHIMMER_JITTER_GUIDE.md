# Shimmer & Jitter Analysis for Conversation Test

## Overview
Shimmer and jitter measurements have been implemented for the "Conversation" test in the Voice Test Assessment. These metrics are automatically calculated and displayed after recording.

## Metrics Explained

### **Jitter (Local)**
- **Definition**: Variation in period length between consecutive pitch cycles
- **Healthy Range**: < 1.04% (normal voice)
- **Clinical Significance**: Higher jitter indicates vocal instability or dysphonia
- **Unit**: Percentage (%)

### **Shimmer (Local)**
- **Definition**: Variation in amplitude between consecutive pitch cycles
- **Healthy Range**: < 3.81% (normal voice)
- **Clinical Significance**: Higher shimmer indicates amplitude fluctuations, associated with hoarseness
- **Unit**: Percentage (%)

## Implementation Details

### Backend Files

**1. `backend/core/pitch_utils.py`**
- Added `extract_shimmer_and_jitter(wav_path)` function
- Added `extract_shimmer_and_jitter_from_float_array(audio_data, sample_rate)` function
- Uses Praat's PointProcess method with:
  - Pitch floor: 75 Hz
  - Pitch ceiling: 600 Hz
  - Min period: 0.0001 seconds
  - Max period: 0.02 seconds
  - Max period factor: 1.3
  - Max amplitude factor: 1.6

**2. `backend/routes/pitch_analysis.py`**
- Added `ShimmerJitterResponse` Pydantic model
- Added `POST /api/shimmer-jitter/analyze` endpoint
- Accepts audio_data (float32 array) and sample_rate (Hz)
- Returns jitter and shimmer percentages

### Frontend Files

**1. `src/pages/Assessments/VoiceTestAssessment.jsx`**
- Added `shimmerJitterMetrics` to voice state
- Automatic shimmer/jitter analysis triggered after "Conversation" recording stops
- Frontend calls `POST http://localhost:8000/api/shimmer-jitter/analyze`
- Results displayed in modal below waveform and playback controls

**2. `src/pages/Assessments/VoiceTestAssessment.css`**
- Added `.shimmer-jitter-metrics-container` class (red theme)
- Styled with red accent color (#ef4444) to differentiate from pitch analysis
- Responsive metrics grid layout

## Data Flow

```
User Records Conversation
    ↓
Recording stops, creates WebM blob
    ↓
Frontend decodes to float32 array at device sample rate (48000 Hz)
    ↓
Frontend checks if itemId === "conversation"
    ↓
Frontend calls POST /api/shimmer-jitter/analyze with audio_data + sample_rate
    ↓
Backend creates temporary WAV file from float32 array
    ↓
Praat extracts PointProcess (periodic analysis)
    ↓
Praat calculates:
  - Local jitter (converted to percentage)
  - Local shimmer (converted to percentage)
  - Voiced frame count
    ↓
Backend returns JSON response
    ↓
Frontend stores in voiceStateMap[itemId].shimmerJitterMetrics
    ↓
Modal displays metrics in red-themed container
```

## API Endpoint

**Endpoint**: `POST /api/shimmer-jitter/analyze`

**Request**:
```json
{
  "audio_data": [-0.001, 0.002, -0.0015, ...],
  "sample_rate": 48000
}
```

**Response**:
```json
{
  "jitter_local_percent": 1.23,
  "shimmer_local_percent": 4.56,
  "voiced_frames": 1850,
  "error": null
}
```

## How to Use

1. **Navigate** to Voice Test Assessment
2. **Select** "Conversation" test
3. **Click** "Record" button
4. **Speak naturally** for a few sentences
5. **Click** "Stop Recording"
6. **Metrics will automatically appear** in the modal showing:
   - Local Jitter (%)
   - Local Shimmer (%)
   - Voiced Frames

## Clinical Interpretation

### Normal Voice (Healthy Adults):
- Jitter: < 1.04%
- Shimmer: < 3.81%

### Mild Dysphonia:
- Jitter: 1.04% - 1.50%
- Shimmer: 3.81% - 5.00%

### Moderate to Severe Dysphonia:
- Jitter: > 1.50%
- Shimmer: > 5.00%

## Files Modified/Created

| File | Change |
|------|--------|
| `backend/core/pitch_utils.py` | Added shimmer & jitter extraction functions |
| `backend/routes/pitch_analysis.py` | Added shimmer-jitter endpoint and response model |
| `src/pages/Assessments/VoiceTestAssessment.jsx` | Added state, analysis call, and modal display |
| `src/pages/Assessments/VoiceTestAssessment.css` | Added styling for shimmer-jitter metrics |

## Testing

To test shimmer and jitter analysis:

1. Start both backend and frontend
2. Navigate to Voice Test Assessment
3. Select "Conversation" test
4. Record a few seconds of natural speech
5. Observe metrics appearing in the modal after recording stops
6. Check browser console for debug messages:
   - `[VoiceTest] Analyzing shimmer and jitter for: conversation`
   - `[VoiceTest] Shimmer and Jitter analysis result: {...}`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Metrics not appearing | Check backend logs for Praat errors |
| 404 error | Ensure backend is running and endpoint is registered |
| "error" in response | Check browser console and backend logs |
| Metrics showing NaN | Ensure sufficient voiced frames detected (need valid pitch) |

## Future Enhancements

- Add jitter/shimmer reference ranges visualization
- Add trend analysis across multiple recordings
- Export metrics to clinical report
- Add voice quality assessment scoring
- Correlate jitter/shimmer with perceptual ratings

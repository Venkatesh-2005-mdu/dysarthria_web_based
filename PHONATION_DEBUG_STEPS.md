# Phonation Test: Debugging Steps & Solutions

## Step 1: Check Browser Console for Errors

When you record audio and the waveform disappears:

1. **Open DevTools:** F12 in browser
2. **Go to Console tab**
3. **Look for errors:** Should show red text with error messages
4. **Screenshot or copy the error**

---

## Step 2: Check Backend Terminal Output

When you send audio to backend:

```powershell
# Terminal running backend should show:
[DEBUG] Resonance analysis started...
[DEBUG] Saving audio to: ...
[DEBUG] Audio file saved...
```

**If you see errors like:**
```
subprocess.CalledProcessError: returned non-zero exit status 1
Error extracting waveform: ...
```

This means FFmpeg conversion failed.

---

## Step 3: Root Cause Analysis

### **Scenario A: Waveform Disappears After Backend Runs**

**Cause:** Backend waveform overwrites frontend waveform

**Evidence:**
- Frontend shows waveform immediately ✓
- After ~1-2 seconds, waveform changes or disappears ❌

**Solution:** Prevent backend from overwriting waveform

---

### **Scenario B: Waveform Never Shows + Error in Console**

**Cause:** Backend FFmpeg conversion fails

**Evidence:**
- No waveform at all
- Browser console shows fetch error
- Backend terminal shows: `Error extracting waveform`

**Solution:** Check FFmpeg path or audio format

---

### **Scenario C: Waveform Shows but Different Shape**

**Cause:** Backend downsamples waveform (3000 points instead of full res)

**Evidence:**
- Waveform appears simplified/blocky
- Fewer data points than original

**Solution:** Don't use backend waveform, keep frontend waveform

---

## What We Know

✓ **FFmpeg IS installed** (version 8.0.1)
✓ **Backend code structure is correct**
✓ **Frontend sends audio correctly**

❓ **Unknown:** Exact error from backend

---

## Immediate Fix: Prevent Waveform Overwrite

The backend shouldn't be returning waveform at all. Let me modify the backend:

### **Modified: backend/routes/phonation_test.py**

Change the backend to NOT return waveform. Backend should only return metrics, not waveform.

**Current problematic code:**
```python
return {
    "vowel": vowel,
    "duration_sec": round(duration, 2),
    "waveform": waveform,  # ← REMOVE THIS
    "file_path": str(output_path),
}
```

**Fixed code:**
```python
return {
    "vowel": vowel,
    "duration_sec": round(duration, 2),
    "file_path": str(output_path),
    # Waveform stays in frontend only
}
```

**Then modify frontend to NOT expect waveform from backend:**

```javascript
// PhonationAssessment.jsx - uploadToBackend function

setStateMap((prev) => ({
  ...prev,
  [itemId]: {
    ...prev[itemId],
    backendDuration: response.duration_sec,
    // DO NOT override waveform!
    // waveform stays from earlier analyzeAudioBlob() call
  },
}));
```

---

## Testing Flow

```
1. Record audio
   ├─ Frontend extracts waveform ✓
   ├─ Frontend displays waveform ✓
   
2. Backend processes (silent, in background)
   ├─ Convert PCM → WAV ✓
   ├─ Save to disk ✓
   
3. Frontend gets response
   ├─ Waveform UNCHANGED ✓
   ├─ Display still shows original waveform ✓

Result: Waveform never changes or disappears!
```

---

## Files to Check for Errors

### **1. Check Backend Terminal**
- Does it show FFmpeg errors?
- Does it show file permission errors?
- Does it show soundfile errors?

### **2. Check Browser Console** (F12)
- Does the fetch request succeed or fail?
- What is the response status (200, 400, 500)?
- What is the error message?

### **3. Check Backend app.py**
- Is the route registered correctly?
- Is CORS enabled?

---

## Next Steps

1. **Run backend** and watch terminal for errors
2. **Record audio** in PhonationAssessment
3. **Check console** for fetch response
4. **Tell me** what error appears

Then I can provide exact fix.

---

## What the Files Do

| File | Purpose | Working? |
|------|---------|----------|
| `PhonationAssessment.jsx` | Records audio + displays waveform | ✓ Yes |
| `app.py` | Routes requests | ✓ Probably yes |
| `phonation_test.py` | Receives audio, converts, extracts waveform | ❓ Unknown - likely FFmpeg issue |
| `phonation_utils.py` | Duration/waveform extraction helpers | ✓ Probably works |


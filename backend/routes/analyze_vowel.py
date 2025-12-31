"""
Vowel Analysis - Formant Tracking and Vowel Quality Assessment
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
from scipy import signal
import io

router = APIRouter()

def estimate_formants(audio_data, sr):
    """Estimate formant frequencies using LPC (Linear Predictive Coding)"""
    # Pre-emphasis filter
    pre_emphasis = 0.97
    emphasized = np.append(audio_data[0], audio_data[1:] - pre_emphasis * audio_data[:-1])
    
    # Frame-based analysis
    frame_length = int(0.025 * sr)  # 25ms
    hop_length = int(0.010 * sr)    # 10ms
    
    frames = librosa.util.frame(emphasized, frame_length=frame_length, hop_length=hop_length)
    
    formants_list = []
    
    for frame in frames.T:
        # Apply Hamming window
        windowed = frame * signal.windows.hamming(len(frame))
        
        # LPC analysis (order 12 for typical voice)
        try:
            a = librosa.lpc(windowed, order=12)
            
            # Get roots of LPC polynomial
            roots = np.roots(a)
            roots = roots[np.imag(roots) >= 0]  # Keep only positive imaginary parts
            
            # Convert to frequencies
            angles = np.angle(roots)
            freqs = (angles * sr) / (2 * np.pi)
            
            # Sort and select first 3-4 formants
            formants = sorted(freqs)[:4]
            
            formants_list.append(formants)
        except:
            continue
    
    if formants_list:
        # Average across frames
        formants_array = np.array(formants_list)
        return np.mean(formants_array, axis=0)
    
    return None

@router.post("/vowel/analyze")
async def analyze_vowel(file: UploadFile = File(...), vowel_type: str = ""):
    """Analyze vowel quality and formant frequencies"""
    try:
        if not file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be audio")
        
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        try:
            sr, audio_data = wavfile.read(audio_io)
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)
            audio_data = audio_data.astype(float) / (np.max(np.abs(audio_data)) + 1e-10)
        except:
            audio_data, sr = librosa.load(audio_io, sr=None)
        
        # Estimate formants
        formants = estimate_formants(audio_data, sr)
        
        if formants is None:
            return {"status": "error", "message": "Could not estimate formants"}
        
        # Typical formant ranges for vowels
        vowel_targets = {
            "a": [700, 1220, 2600],  # /ɑ/
            "e": [400, 1600, 2250],  # /e/
            "i": [300, 2200, 3100],  # /i/
            "o": [600, 1000, 2250],  # /o/
            "u": [300, 900, 2100],   # /u/
        }
        
        # Calculate formant accuracy
        formant_accuracy = None
        if vowel_type.lower() in vowel_targets:
            target = np.array(vowel_targets[vowel_type.lower()])
            actual = formants[:len(target)]
            
            # Error in cents (musical interval)
            formant_error = 1200 * np.log2(actual / target)
            formant_accuracy = float(np.mean(np.abs(formant_error)))
        
        return {
            "status": "success",
            "vowel_analysis": {
                "vowel_type": vowel_type,
                "formant_1_hz": float(formants[0]) if len(formants) > 0 else None,
                "formant_2_hz": float(formants[1]) if len(formants) > 1 else None,
                "formant_3_hz": float(formants[2]) if len(formants) > 2 else None,
                "formant_accuracy_cents": formant_accuracy,
                "duration_seconds": len(audio_data) / sr,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/vowel/formants")
async def extract_vowel_formants(file: UploadFile = File(...)):
    """Extract all vowel formants"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        formants = estimate_formants(audio_data, sr)
        
        if formants is None:
            return {"status": "error"}
        
        return {
            "status": "success",
            "formants": [float(f) for f in formants],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

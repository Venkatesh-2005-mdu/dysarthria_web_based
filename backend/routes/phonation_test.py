"""
Phonation Test - Fundamental Frequency and Voice Quality Analysis
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
import io

router = APIRouter()

def extract_fundamental_frequency(audio_data, sr):
    """Extract fundamental frequency using librosa's pyin algorithm"""
    try:
        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio_data,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        # Filter out unvoiced segments
        voiced_f0 = f0[voiced_flag]
        if len(voiced_f0) > 0:
            return {
                'mean_f0': float(np.mean(voiced_f0)),
                'min_f0': float(np.min(voiced_f0)),
                'max_f0': float(np.max(voiced_f0)),
                'std_f0': float(np.std(voiced_f0)),
            }
        return None
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"F0 extraction error: {str(e)}")

def calculate_jitter(f0_values, sr):
    """Calculate jitter (frequency perturbation)"""
    if len(f0_values) < 2:
        return None
    
    f0_diff = np.abs(np.diff(f0_values))
    jitter_percent = (np.mean(f0_diff) / np.mean(f0_values)) * 100
    return float(jitter_percent)

def calculate_shimmer(audio_data, sr):
    """Calculate shimmer (amplitude perturbation)"""
    # Simplified shimmer calculation using frame-based energy
    frame_length = int(0.025 * sr)  # 25ms frames
    hop_length = int(0.010 * sr)    # 10ms hop
    
    frames = librosa.util.frame(audio_data, frame_length=frame_length, hop_length=hop_length)
    frame_energy = np.sqrt(np.sum(frames**2, axis=0))
    
    if len(frame_energy) < 2:
        return None
    
    energy_diff = np.abs(np.diff(frame_energy))
    shimmer_db = 20 * np.log10(np.mean(energy_diff) / np.mean(frame_energy) + 1e-10)
    return float(shimmer_db)

@router.post("/phonation/analyze")
async def analyze_phonation(file: UploadFile = File(...)):
    """Analyze phonation for fundamental frequency, jitter, and shimmer"""
    try:
        if not file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be audio")
        
        # Read audio file
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        # Try WAV format first
        try:
            sr, audio_data = wavfile.read(audio_io)
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)
            audio_data = audio_data.astype(float) / np.max(np.abs(audio_data))
        except:
            # Fallback to librosa for other formats
            audio_data, sr = librosa.load(audio_io, sr=None)
        
        # Extract fundamental frequency
        f0_results = extract_fundamental_frequency(audio_data, sr)
        
        if f0_results is None:
            return {
                "status": "unvoiced",
                "message": "Insufficient voiced segments detected"
            }
        
        # Extract F0 contour for jitter calculation
        f0, voiced_flag, _ = librosa.pyin(
            audio_data,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        voiced_f0 = f0[voiced_flag]
        
        # Calculate voice quality metrics
        jitter = calculate_jitter(voiced_f0, sr)
        shimmer = calculate_shimmer(audio_data, sr)
        
        return {
            "status": "success",
            "phonation_metrics": {
                "fundamental_frequency": f0_results,
                "jitter_percent": jitter,
                "shimmer_db": shimmer,
                "duration_seconds": len(audio_data) / sr,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

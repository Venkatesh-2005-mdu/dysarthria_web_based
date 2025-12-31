"""
S/Z Ratio Analysis - Fricative Duration Assessment
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
from scipy import signal
import io

router = APIRouter()

def detect_fricatives(audio_data, sr):
    """Detect fricative consonants (S/Z) in audio using spectral features"""
    # Use STFT to analyze frequency content
    D = librosa.stft(audio_data)
    magnitude = np.abs(D)
    
    # Compute spectral centroid (fricatives have high frequency content)
    frequencies = librosa.fft_frequencies(sr=sr)
    spec_centroid = librosa.feature.spectral_centroid(S=magnitude, sr=sr)[0]
    
    # Fricatives typically have centroid > 2000 Hz and high energy
    frame_energy = np.sqrt(np.sum(magnitude**2, axis=0))
    
    # Detect frames likely to be fricatives
    high_freq_mask = spec_centroid > 2000
    high_energy_mask = frame_energy > np.mean(frame_energy) * 0.2
    fricative_frames = high_freq_mask & high_energy_mask
    
    return fricative_frames, spec_centroid, frame_energy

def calculate_fricative_duration(fricative_frames, sr):
    """Convert fricative frames to duration in seconds"""
    hop_length = 512  # librosa default
    num_fricative_frames = np.sum(fricative_frames)
    duration = (num_fricative_frames * hop_length) / sr
    return max(0, duration)

@router.post("/sz-ratio/analyze")
async def analyze_sz_ratio(file: UploadFile = File(...)):
    """Analyze S/Z ratio from audio file (fricative duration)"""
    try:
        if not file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be audio")
        
        # Read audio file
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        try:
            sr, audio_data = wavfile.read(audio_io)
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)
            audio_data = audio_data.astype(float) / (np.max(np.abs(audio_data)) + 1e-10)
        except:
            audio_data, sr = librosa.load(audio_io, sr=None)
        
        # Detect fricative segments
        fricative_frames, spec_centroid, frame_energy = detect_fricatives(audio_data, sr)
        
        # Calculate fricative duration
        fricative_duration = calculate_fricative_duration(fricative_frames, sr)
        
        # Get spectral properties of fricatives
        fricative_spec_centroid = np.mean(spec_centroid[fricative_frames]) if np.any(fricative_frames) else 0
        
        # Calculate S/Z ratio (typically S duration / Z duration, estimated from spectral features)
        # High frequency fricatives (S ~4500 Hz) vs lower frequency fricatives (Z ~1500 Hz)
        high_freq_fricatives = fricative_frames & (spec_centroid > 3500)
        low_freq_fricatives = fricative_frames & (spec_centroid < 3500)
        
        s_duration = calculate_fricative_duration(high_freq_fricatives, sr)
        z_duration = calculate_fricative_duration(low_freq_fricatives, sr)
        
        sz_ratio = s_duration / z_duration if z_duration > 0 else 0
        
        return {
            "status": "success",
            "sz_ratio_analysis": {
                "total_fricative_duration_seconds": float(fricative_duration),
                "s_fricative_duration_seconds": float(s_duration),
                "z_fricative_duration_seconds": float(z_duration),
                "sz_ratio": float(sz_ratio),
                "mean_spectral_centroid_hz": float(fricative_spec_centroid),
                "total_duration_seconds": len(audio_data) / sr,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/sz-ratio/measure-duration")
async def measure_fricative_duration(file: UploadFile = File(...), fricative_type: str = "all"):
    """Measure specific fricative duration (S, Z, or all)"""
    try:
        if not file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be audio")
        
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        fricative_frames, spec_centroid, _ = detect_fricatives(audio_data, sr)
        
        if fricative_type == "S":
            frames = fricative_frames & (spec_centroid > 3500)
        elif fricative_type == "Z":
            frames = fricative_frames & (spec_centroid < 3500)
        else:
            frames = fricative_frames
        
        duration = calculate_fricative_duration(frames, sr)
        
        return {
            "status": "success",
            "fricative_type": fricative_type,
            "duration_seconds": float(duration),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

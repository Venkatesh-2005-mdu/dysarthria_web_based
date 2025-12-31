"""
General Audio Analysis - Waveform and Basic Metrics
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
import io

router = APIRouter()

@router.post("/analyze/general")
async def general_audio_analysis(file: UploadFile = File(...)):
    """General audio analysis including waveform data"""
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
        
        # Basic metrics
        duration = len(audio_data) / sr
        rms_energy = float(np.sqrt(np.mean(audio_data ** 2)))
        peak_amplitude = float(np.max(np.abs(audio_data)))
        
        return {
            "status": "success",
            "audio_analysis": {
                "duration_seconds": duration,
                "sample_rate": sr,
                "rms_energy": rms_energy,
                "peak_amplitude": peak_amplitude,
                "num_samples": len(audio_data),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/waveform/extract")
async def extract_waveform(file: UploadFile = File(...), downsample: int = 1):
    """Extract waveform data for visualization"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        # Downsample for efficiency
        if downsample > 1:
            audio_data = audio_data[::downsample]
            sr = sr // downsample
        
        # Normalize
        audio_data = audio_data / (np.max(np.abs(audio_data)) + 1e-10)
        
        return {
            "status": "success",
            "waveform": {
                "samples": audio_data.tolist(),
                "sample_rate": sr,
                "duration_seconds": len(audio_data) / sr,
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

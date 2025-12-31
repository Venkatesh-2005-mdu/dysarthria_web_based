"""
Resonance Analysis - Nasal and Oral Resonance Detection
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
from scipy import signal
import io

router = APIRouter()

def analyze_spectral_peaks(audio_data, sr):
    """Analyze spectral peaks for resonance characteristics"""
    # Compute spectrogram
    D = librosa.stft(audio_data)
    S = np.abs(D)
    
    # Get spectral features
    spec_centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    spec_flatness = librosa.feature.spectral_flatness(S=S)[0]
    
    # Compute mel-frequency cepstral coefficients (MFCCs)
    mfcc = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
    
    frequencies = librosa.fft_frequencies(sr=sr)
    
    return {
        'spec_centroid': spec_centroid,
        'spec_flatness': spec_flatness,
        'mfcc': mfcc,
        'frequencies': frequencies,
        'magnitude': S,
    }

def detect_nasality(audio_data, sr):
    """Detect nasal resonance characteristics"""
    spectral_data = analyze_spectral_peaks(audio_data, sr)
    
    # Nasal sounds have characteristic spectral dips at higher frequencies
    magnitude = spectral_data['magnitude']
    frequencies = spectral_data['frequencies']
    
    # Focus on nasal frequency range (typically 200-2000 Hz)
    nasal_range = (frequencies >= 200) & (frequencies <= 2000)
    nasal_energy = np.mean(magnitude[nasal_range, :], axis=0)
    
    # High frequency range (>3000 Hz) for comparison
    high_range = frequencies >= 3000
    high_energy = np.mean(magnitude[high_range, :], axis=0)
    
    # Nasal ratio
    nasal_ratio = np.mean(nasal_energy) / (np.mean(high_energy) + 1e-10)
    
    return float(nasal_ratio), spectral_data

def detect_nasality_level(audio_data, sr):
    """Classify nasality level: normal, mild, moderate, severe"""
    nasal_ratio, _ = detect_nasality(audio_data, sr)
    
    # Classification thresholds (these are empirical and may need adjustment)
    if nasal_ratio < 0.5:
        return "normal"
    elif nasal_ratio < 1.0:
        return "mild"
    elif nasal_ratio < 1.5:
        return "moderate"
    else:
        return "severe"

@router.post("/resonance/analyze")
async def analyze_resonance(file: UploadFile = File(...)):
    """Analyze resonance characteristics including nasality"""
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
        
        # Analyze spectral features
        nasal_ratio, spectral_data = detect_nasality(audio_data, sr)
        nasality_level = detect_nasality_level(audio_data, sr)
        
        # Get mean spectral features
        mean_centroid = float(np.mean(spectral_data['spec_centroid']))
        mean_flatness = float(np.mean(spectral_data['spec_flatness']))
        
        return {
            "status": "success",
            "resonance_analysis": {
                "nasal_resonance_ratio": nasal_ratio,
                "nasality_level": nasality_level,
                "spectral_centroid_hz": mean_centroid,
                "spectral_flatness": mean_flatness,
                "duration_seconds": len(audio_data) / sr,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/resonance/nasality-detect")
async def detect_nasality_endpoint(file: UploadFile = File(...)):
    """Detect nasality in speech"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        nasality_level = detect_nasality_level(audio_data, sr)
        nasal_ratio, _ = detect_nasality(audio_data, sr)
        
        return {
            "status": "success",
            "nasality": {
                "level": nasality_level,
                "ratio": float(nasal_ratio),
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

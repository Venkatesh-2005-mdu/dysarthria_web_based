"""
Pataka Test Processing - Rapid Syllable Repetition Analysis
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
from scipy import signal
import io

router = APIRouter()

def detect_syllable_onsets(audio_data, sr):
    """Detect syllable onsets from plosives"""
    # Compute energy envelope
    frame_length = int(0.010 * sr)  # 10ms
    hop_length = int(0.005 * sr)    # 5ms
    
    frames = librosa.util.frame(audio_data, frame_length=frame_length, hop_length=hop_length)
    frame_energy = np.sqrt(np.sum(frames**2, axis=0))
    
    # Detect peaks (onsets) in energy
    threshold = np.mean(frame_energy) * 0.3
    onsets = librosa.util.peak_pick(frame_energy, pre_max=3, post_max=3, pre_avg=3, post_avg=3, delta=threshold, wait=int(0.05*sr/hop_length))
    
    # Convert frames to time
    times = librosa.frames_to_time(onsets, sr=sr, hop_length=hop_length)
    
    return times

def calculate_syllable_rate(onset_times):
    """Calculate syllables per second from onset times"""
    if len(onset_times) < 2:
        return None
    
    intervals = np.diff(onset_times)
    mean_interval = np.mean(intervals)
    
    syllable_rate = 1.0 / mean_interval if mean_interval > 0 else 0
    
    return {
        'syllable_rate': float(syllable_rate),
        'mean_interval_ms': float(mean_interval * 1000),
        'num_syllables': len(onset_times),
        'regularity': float(np.std(intervals) / np.mean(intervals) if mean_interval > 0 else 0),
    }

@router.post("/pataka/analyze")
async def analyze_pataka_test(file: UploadFile = File(...)):
    """Analyze rapid syllable repetition (pataka test)"""
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
        
        # Detect syllable onsets
        onset_times = detect_syllable_onsets(audio_data, sr)
        
        if len(onset_times) < 3:
            return {"status": "error", "message": "Insufficient syllables detected"}
        
        # Calculate metrics
        metrics = calculate_syllable_rate(onset_times)
        
        return {
            "status": "success",
            "pataka_analysis": {
                "syllable_rate_per_second": metrics['syllable_rate'],
                "mean_interval_ms": metrics['mean_interval_ms'],
                "num_syllables": metrics['num_syllables'],
                "regularity_score": 100 - (metrics['regularity'] * 100),  # Higher is more regular
                "duration_seconds": len(audio_data) / sr,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/pataka/rate")
async def get_pataka_rate(file: UploadFile = File(...)):
    """Get pataka syllable rate"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        onset_times = detect_syllable_onsets(audio_data, sr)
        
        if len(onset_times) < 2:
            return {"status": "error"}
        
        metrics = calculate_syllable_rate(onset_times)
        
        return {
            "status": "success",
            "syllable_rate": metrics['syllable_rate'],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import tempfile
import os
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.pitch_utils import (
    extract_pitch_from_float_array, 
    extract_pitch_and_overall_f0,
    extract_shimmer_and_jitter_from_float_array,
    extract_average_intensity_from_float_array,
    extract_hnr_and_f0_from_float_array,
)

router = APIRouter()

# Ensure uploads directory exists
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class PitchAnalysisRequest(BaseModel):
    audio_data: list  # Float32 samples
    sample_rate: int  # Sample rate in Hz


class PitchAnalysisResponse(BaseModel):
    overall_f0_weighted_hz: float | None
    pitch_times: list
    pitch_values: list
    voiced_frames: int
    unvoiced_frames: int
    error: str | None = None


class ShimmerJitterResponse(BaseModel):
    jitter_local_percent: float | None
    shimmer_local_percent: float | None
    voiced_frames: int
    error: str | None = None


class IntensityResponse(BaseModel):
    average_voiced_intensity_db: float | None
    instantaneous_loudness_times: list
    instantaneous_loudness_values: list
    error: str | None = None


class HNRAndF0Response(BaseModel):
    hnr_db: float | None
    f0_hz: float | None
    error: str | None = None


@router.post("/pitch/analyze")
async def analyze_pitch(request: PitchAnalysisRequest):
    """
    Analyze pitch from audio data.
    
    Accepts:
        audio_data: List of float32 samples
        sample_rate: Sample rate in Hz
        
    Returns:
        overall_f0_weighted_hz: Voiced-time weighted mean F0 (Hz)
        pitch_times: Time stamps of pitch analysis (seconds)
        pitch_values: Instantaneous F0 values (Hz)
        voiced_frames: Number of voiced frames
        unvoiced_frames: Number of unvoiced frames
    """
    try:
        # Convert list to numpy array
        audio_array = np.array(request.audio_data, dtype=np.float32)
        
        # Extract pitch
        result = extract_pitch_from_float_array(audio_array, request.sample_rate)
        
        return PitchAnalysisResponse(
            overall_f0_weighted_hz=result.get("overall_f0_weighted_hz"),
            pitch_times=result.get("pitch_times", []),
            pitch_values=result.get("pitch_values", []),
            voiced_frames=result.get("voiced_frames", 0),
            unvoiced_frames=result.get("unvoiced_frames", 0),
            error=result.get("error"),
        )
    except Exception as e:
        print(f"Error in pitch analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pitch/analyze-file")
async def analyze_pitch_file(audio: UploadFile = File(...)):
    """
    Analyze pitch from uploaded audio file.
    
    Accepts:
        audio: WAV or other audio file
        
    Returns:
        Pitch analysis metrics (see /pitch/analyze)
    """
    temp_file = None
    try:
        # Save uploaded file to temp location
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        content = await audio.read()
        temp_file.write(content)
        temp_file.close()
        
        # Extract pitch
        result = extract_pitch_and_overall_f0(temp_file.name)
        
        return PitchAnalysisResponse(
            overall_f0_weighted_hz=result.get("overall_f0_weighted_hz"),
            pitch_times=result.get("pitch_times", []),
            pitch_values=result.get("pitch_values", []),
            voiced_frames=result.get("voiced_frames", 0),
            unvoiced_frames=result.get("unvoiced_frames", 0),
            error=result.get("error"),
        )
    except Exception as e:
        print(f"Error in pitch analysis file endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


@router.post("/shimmer-jitter/analyze")
async def analyze_shimmer_jitter(request: PitchAnalysisRequest):
    """
    Analyze shimmer and jitter from audio data.
    
    Accepts:
        audio_data: List of float32 samples
        sample_rate: Sample rate in Hz
        
    Returns:
        jitter_local_percent: Local jitter (percentage)
        shimmer_local_percent: Local shimmer (percentage)
        voiced_frames: Number of voiced frames detected
    """
    try:
        # Convert list to numpy array
        audio_array = np.array(request.audio_data, dtype=np.float32)
        
        # Extract shimmer and jitter
        result = extract_shimmer_and_jitter_from_float_array(audio_array, request.sample_rate)
        
        return ShimmerJitterResponse(
            jitter_local_percent=result.get("jitter_local_percent"),
            shimmer_local_percent=result.get("shimmer_local_percent"),
            voiced_frames=result.get("voiced_frames", 0),
            error=result.get("error"),
        )
    except Exception as e:
        print(f"Error in shimmer-jitter analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intensity/analyze")
async def analyze_intensity(request: PitchAnalysisRequest):
    """
    Analyze average intensity from audio data.
    
    Accepts:
        audio_data: List of float32 samples
        sample_rate: Sample rate in Hz
        
    Returns:
        average_voiced_intensity_db: Average intensity on voiced frames (dB SPL)
        instantaneous_loudness_times: Time stamps for loudness frames (seconds)
        instantaneous_loudness_values: Loudness values for all frames (dB)
    """
    try:
        # Convert list to numpy array
        audio_array = np.array(request.audio_data, dtype=np.float32)
        
        # Extract intensity
        result = extract_average_intensity_from_float_array(audio_array, request.sample_rate)
        
        return IntensityResponse(
            average_voiced_intensity_db=result.get("average_voiced_intensity_db"),
            instantaneous_loudness_times=result.get("instantaneous_loudness_times", []),
            instantaneous_loudness_values=result.get("instantaneous_loudness_values", []),
            error=result.get("error"),
        )
    except Exception as e:
        print(f"Error in intensity analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hnr-f0/analyze")
async def analyze_hnr_f0(request: PitchAnalysisRequest):
    """
    Analyze Harmonic Noise Ratio (HNR) and Fundamental Frequency (F0) from audio data.
    
    Accepts:
        audio_data: List of float32 samples
        sample_rate: Sample rate in Hz
        
    Returns:
        hnr_db: Harmonic Noise Ratio in dB
        f0_hz: Fundamental frequency (mean F0) in Hz
    """
    try:
        print(f"[HNR-F0] Request received. Audio data length: {len(request.audio_data)}, Sample rate: {request.sample_rate}")
        
        # Convert list to numpy array
        audio_array = np.array(request.audio_data, dtype=np.float32)
        
        print(f"[HNR-F0] Audio array shape: {audio_array.shape}, dtype: {audio_array.dtype}")
        
        # Extract HNR and F0
        result = extract_hnr_and_f0_from_float_array(audio_array, request.sample_rate)
        
        print(f"[HNR-F0] Analysis complete. Result: {result}")
        
        return HNRAndF0Response(
            hnr_db=result.get("hnr_db"),
            f0_hz=result.get("f0_hz"),
            error=result.get("error"),
        )
    except Exception as e:
        print(f"Error in HNR-F0 analysis endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

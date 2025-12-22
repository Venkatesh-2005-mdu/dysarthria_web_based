"""
Resonance Analysis Endpoint
Handles resonance quality assessment for nasal/oral resonance differentiation
"""

from fastapi import APIRouter, UploadFile, File, Query
from fastapi.responses import JSONResponse
import librosa
import numpy as np
import os
from pathlib import Path

from core.resonance_utils import (
    calculate_resonance_metrics,
    generate_spectrogram,
)

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/resonance")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/resonance/analyze")
async def analyze_resonance_audio(
    audio: UploadFile = File(...),
    vowel: str = Query("o", description="Vowel being tested (o, a, u, i, e, etc.)"),
):
    """
    Analyze resonance characteristics from uploaded audio
    
    Expected input: WebM or WAV audio file
    
    Returns:
    - A1 frequency and magnitude (oral/first formant)
    - P0 frequency and magnitude (nasal peak)
    - A1-P0 difference (key metric in dB)
    - Nasality ratio percentage
    - Classification (Normal, Hypernasality, Hyponasality)
    - Spectrogram data for visualization
    - LPC spectrum
    
    Clinical parameters:
    - Sampling rate: 44100 Hz (standardized)
    - Frame analysis: 25ms Gaussian windows
    - Spectral range: 0-5000 Hz
    """
    print(f"[DEBUG] Resonance analysis started for vowel: {vowel}")
    try:
        # Save uploaded file
        filename = f"resonance_{vowel}_{audio.filename}"
        filepath = UPLOAD_DIR / filename
        
        print(f"[DEBUG] Saving audio to: {filepath}")
        contents = await audio.read()
        with open(filepath, "wb") as f:
            f.write(contents)
        print(f"[DEBUG] Audio file saved, size: {len(contents)} bytes")
        
        # Load audio with librosa (handles various formats)
        # Resample to 44100 Hz for standardized analysis
        try:
            print("[DEBUG] Loading audio with librosa...")
            y, sr = librosa.load(str(filepath), sr=44100, mono=True)
            print(f"[DEBUG] Audio loaded: {len(y)} samples, sr={sr}")
        except Exception as e:
            print(f"[DEBUG] Audio loading failed: {e}")
            return JSONResponse(
                status_code=400,
                content={"error": f"Audio loading failed: {str(e)}"}
            )
        
        # Remove silence from beginning/end for cleaner analysis
        print("[DEBUG] Trimming silence...")
        y_trimmed, _ = librosa.effects.trim(y, top_db=30, ref=np.max)
        print(f"[DEBUG] Trimmed audio: {len(y_trimmed)} samples")
        
        # Ensure minimum audio length (2 seconds)
        min_samples = 2 * sr
        if len(y_trimmed) < min_samples:
            print(f"[DEBUG] Audio too short: {len(y_trimmed)} < {min_samples}")
            return JSONResponse(
                status_code=400,
                content={"error": f"Audio too short. Minimum 2 seconds required."}
            )
        
        # Calculate resonance metrics
        print("[DEBUG] Calculating resonance metrics...")
        resonance_metrics = calculate_resonance_metrics(y_trimmed, sr=sr)
        print(f"[DEBUG] Resonance metrics calculated: {list(resonance_metrics.keys())}")
        
        # Generate spectrogram
        print("[DEBUG] Generating spectrogram...")
        spectrogram_data = generate_spectrogram(y_trimmed, sr=sr)
        print(f"[DEBUG] Spectrogram generated")
        
        # Combine results
        result = {
            "vowel": vowel,
            "sampling_rate": sr,
            "duration": len(y_trimmed) / sr,
            **resonance_metrics,  # Include A1, P0, metrics
            "spectrogram": spectrogram_data["spectrogram"],
            "spectrogram_frequencies": spectrogram_data["frequencies"],
            "spectrogram_times": spectrogram_data["times"],
        }
        
        print(f"[DEBUG] Returning result with keys: {list(result.keys())}")
        return JSONResponse(content=result)
        
    except Exception as e:
        print(f"[ERROR] Resonance analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Analysis failed: {str(e)}"}
        )


@router.post("/resonance/compare")
async def compare_resonance(
    oral_audio: UploadFile = File(..., description="Oral sound sample (e.g., /o/)"),
    nasal_audio: UploadFile = File(..., description="Nasal sound sample (e.g., /m/)"),
):
    """
    Compare oral vs nasal resonance to establish baseline
    Useful for clinical validation
    
    Returns comparison metrics for both sounds
    """
    try:
        results = {}
        
        for sound_type, audio_file in [("oral", oral_audio), ("nasal", nasal_audio)]:
            # Save and load
            filename = f"resonance_{sound_type}_{audio_file.filename}"
            filepath = UPLOAD_DIR / filename
            
            contents = await audio_file.read()
            with open(filepath, "wb") as f:
                f.write(contents)
            
            y, sr = librosa.load(str(filepath), sr=44100, mono=True)
            y_trimmed, _ = librosa.effects.trim(y, top_db=30, ref=np.max)
            
            # Analyze
            metrics = calculate_resonance_metrics(y_trimmed, sr=sr)
            results[sound_type] = metrics
        
        # Calculate comparison
        oral_nasality = results["oral"].get("nasality_ratio", 50)
        nasal_nasality = results["nasal"].get("nasality_ratio", 50)
        
        comparison = {
            "oral_sample": results["oral"],
            "nasal_sample": results["nasal"],
            "nasality_difference": round(nasal_nasality - oral_nasality, 2),
            "interpretation": (
                "Good differentiation - nasal resonance is distinct"
                if (nasal_nasality - oral_nasality) > 20
                else "Poor differentiation - nasal/oral resonance similar"
            )
        }
        
        return JSONResponse(content=comparison)
        
    except Exception as e:
        print(f"Resonance comparison error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Comparison failed: {str(e)}"}
        )

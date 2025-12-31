"""
Pitch Analysis - Fundamental Frequency Detailed Analysis
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import wavfile
import numpy as np
import librosa
import io

router = APIRouter()

def extract_detailed_f0(audio_data, sr):
    """Extract detailed F0 contour and statistics"""
    try:
        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio_data,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=512
        )
        
        voiced_f0 = f0[voiced_flag]
        
        if len(voiced_f0) == 0:
            return None
        
        return {
            'f0_contour': f0,
            'voiced_flag': voiced_flag,
            'voiced_f0': voiced_f0,
            'voiced_probs': voiced_probs,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"F0 extraction failed: {str(e)}")

def note_from_frequency(freq):
    """Convert frequency to musical note"""
    if freq <= 0:
        return None
    A4 = 440
    C0 = A4 * pow(2, -4.75)
    h = 12 * np.log2(freq / C0)
    octave = int(h) // 12
    note_in_octave = int(h) % 12
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return f"{notes[note_in_octave]}{octave}"

@router.post("/pitch/analyze")
async def analyze_pitch(file: UploadFile = File(...)):
    """Comprehensive pitch analysis"""
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
        
        # Extract F0
        f0_data = extract_detailed_f0(audio_data, sr)
        
        if f0_data is None:
            return {
                "status": "unvoiced",
                "message": "Insufficient voiced segments for pitch analysis"
            }
        
        voiced_f0 = f0_data['voiced_f0']
        
        # Calculate statistics
        mean_f0 = float(np.mean(voiced_f0))
        std_f0 = float(np.std(voiced_f0))
        min_f0 = float(np.min(voiced_f0))
        max_f0 = float(np.max(voiced_f0))
        
        # Vibrato analysis (pitch variation)
        vibrato_depth = float(np.std(np.diff(voiced_f0)))
        
        # Pitch range in semitones
        pitch_range_st = 12 * np.log2(max_f0 / min_f0)
        
        return {
            "status": "success",
            "pitch_analysis": {
                "mean_frequency_hz": mean_f0,
                "std_frequency_hz": std_f0,
                "min_frequency_hz": min_f0,
                "max_frequency_hz": max_f0,
                "pitch_range_semitones": float(pitch_range_st),
                "vibrato_depth_hz": vibrato_depth,
                "mean_note": note_from_frequency(mean_f0),
                "min_note": note_from_frequency(min_f0),
                "max_note": note_from_frequency(max_f0),
                "duration_seconds": len(audio_data) / sr,
                "voiced_proportion": float(np.sum(f0_data['voiced_flag']) / len(f0_data['voiced_flag'])),
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/pitch/frequency-range")
async def get_frequency_range(file: UploadFile = File(...)):
    """Get pitch frequency range"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        f0_data = extract_detailed_f0(audio_data, sr)
        
        if f0_data is None:
            return {"status": "unvoiced"}
        
        voiced_f0 = f0_data['voiced_f0']
        
        return {
            "status": "success",
            "frequency_range": {
                "min_hz": float(np.min(voiced_f0)),
                "max_hz": float(np.max(voiced_f0)),
                "mean_hz": float(np.mean(voiced_f0)),
                "range_st": float(12 * np.log2(np.max(voiced_f0) / np.min(voiced_f0))),
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

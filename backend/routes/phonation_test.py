from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import tempfile
import os
import subprocess
import soundfile as sf
from pathlib import Path

router = APIRouter()

# Ensure uploads directory exists
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class AudioData(BaseModel):
    vowel: str
    audio_data: list
    sample_rate: int


def convert_pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Convert raw PCM bytes to WAV format using FFmpeg
    Returns path to converted WAV file
    """
    temp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".bin")
    temp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")

    temp_in.write(pcm_bytes)
    temp_in.close()

    cmd = [
        "ffmpeg", "-y", "-f", "f32le", "-ar", str(sample_rate), "-ac", "1",
        "-i", temp_in.name,
        "-ar", "16000", "-ac", "1",  # Output: 16k mono
        temp_out.name
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return temp_out.name
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail="FFmpeg audio conversion failed")
    finally:
        os.unlink(temp_in.name)


def extract_waveform_from_wav(wav_path: str, max_points: int = 3000) -> tuple:
    """
    Extract waveform data from WAV file for Plotly visualization
    Returns: (waveform_list, sample_rate, duration)
    """
    try:
        audio_data, sr = sf.read(wav_path)
        
        # Ensure mono
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]
        
        # Calculate duration
        duration = len(audio_data) / sr
        
        # Downsample for display (Plotly-friendly)
        factor = max(1, len(audio_data) // max_points)
        waveform = audio_data[::factor].tolist()
        
        return waveform, sr, duration
    except Exception as e:
        print(f"Error extracting waveform: {e}")
        raise


@router.post("/phonation/analyze")
async def analyze_phonation(data: AudioData):
    """
    Analyze phonation vowel from decoded PCM data
    Expects: {vowel: 'a'|'ii'|'u'|'uhm', audio_data: float[], sample_rate: int}
    """
    try:
        # Convert audio data to numpy array
        audio_array = np.array(data.audio_data, dtype=np.float32)
        sr = data.sample_rate
        vowel = data.vowel

        # Convert float32 to PCM bytes (16-bit)
        # Normalize to [-1, 1] range if needed
        audio_array = np.clip(audio_array, -1.0, 1.0)
        pcm_bytes = (audio_array * 32767).astype(np.int16).tobytes()

        # Convert PCM to WAV using FFmpeg
        wav_path = convert_pcm_to_wav(pcm_bytes, sr)

        # Extract audio metadata (duration, sample rate)
        # DO NOT extract waveform - frontend waveform is more accurate
        audio_data, sample_rate = sf.read(wav_path)
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]
        duration = len(audio_data) / sample_rate

        # Save WAV to uploads directory
        output_path = UPLOADS_DIR / f"{vowel}_{int(duration * 1000)}.wav"
        if os.path.exists(wav_path):
            os.rename(wav_path, output_path)

        return {
            "vowel": vowel,
            "duration_sec": round(duration, 2),
            "sampling_rate": sample_rate,
            "file_path": str(output_path),
            "status": "success"
            # NOTE: Waveform is NOT returned - frontend keeps its waveform
        }
    except Exception as e:
        print(f"analyze_phonation error: {e}")
        return {
            "vowel": "error",
            "duration_sec": 0,
            "sampling_rate": 16000,
            "waveform": [],
            "error": str(e)
        }


@router.post("/upload/{vowel}")
async def upload_phonation(vowel: str, data: AudioData):
    """
    Alternative endpoint for vowel upload
    """
    return await analyze_phonation(data)

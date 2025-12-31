"""
Rate of Speech Analysis - Words Per Minute and Speech Rate Calculation
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from scipy.io import wavfile
import numpy as np
import librosa
import io

router = APIRouter()

class RateOfSpeechRequest(BaseModel):
    transcribed_text: str
    duration_seconds: float

def detect_speech_segments(audio_data, sr):
    """Detect voiced/speech segments in audio"""
    # Use simple energy-based voice activity detection
    frame_length = int(0.025 * sr)  # 25ms frames
    hop_length = int(0.010 * sr)    # 10ms hop
    
    frames = librosa.util.frame(audio_data, frame_length=frame_length, hop_length=hop_length)
    frame_energy = np.sqrt(np.sum(frames**2, axis=0))
    
    # Threshold-based detection
    threshold = np.mean(frame_energy) * 0.1
    speech_frames = frame_energy > threshold
    
    # Convert frames to time
    times = librosa.frames_to_time(np.arange(len(frame_energy)), sr=sr, hop_length=hop_length)
    
    speech_time = np.sum(speech_frames) * (hop_length / sr)
    return speech_time, times[speech_frames] if len(times[speech_frames]) > 0 else []

def calculate_wpm(word_count, duration_seconds):
    """Calculate words per minute"""
    if duration_seconds == 0:
        return 0
    return (word_count / duration_seconds) * 60

def calculate_syllable_rate(word_count, duration_seconds):
    """Estimate syllables per second (average ~1.5 syllables per word)"""
    if duration_seconds == 0:
        return 0
    syllable_count = word_count * 1.5
    return syllable_count / duration_seconds

@router.post("/rate-of-speech/analyze")
async def analyze_rate_of_speech(file: UploadFile = File(...), transcribed_text: str = ""):
    """Analyze rate of speech from audio file"""
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
        
        # Calculate duration
        total_duration = len(audio_data) / sr
        
        # Detect speech segments
        speech_duration, _ = detect_speech_segments(audio_data, sr)
        
        # Count words from transcribed text
        word_count = len(transcribed_text.split()) if transcribed_text else 0
        
        # Calculate metrics
        wpm = calculate_wpm(word_count, speech_duration)
        syllable_rate = calculate_syllable_rate(word_count, speech_duration)
        
        # Articulation rate (words per second, excluding pauses)
        articulation_rate = (word_count / speech_duration) if speech_duration > 0 else 0
        
        return {
            "status": "success",
            "rate_of_speech": {
                "words_per_minute": float(wpm),
                "articulation_rate_wps": float(articulation_rate),
                "syllable_rate_sps": float(syllable_rate),
                "total_duration_seconds": float(total_duration),
                "speech_duration_seconds": float(speech_duration),
                "pause_duration_seconds": float(total_duration - speech_duration),
                "word_count": word_count,
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/rate-of-speech/calculate")
async def calculate_rate_of_speech(request: RateOfSpeechRequest):
    """Calculate rate of speech from text and duration"""
    try:
        word_count = len(request.transcribed_text.split())
        wpm = calculate_wpm(word_count, request.duration_seconds)
        syllable_rate = calculate_syllable_rate(word_count, request.duration_seconds)
        
        return {
            "status": "success",
            "rate_of_speech": {
                "words_per_minute": float(wpm),
                "syllable_rate_sps": float(syllable_rate),
                "total_duration_seconds": request.duration_seconds,
                "word_count": word_count,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

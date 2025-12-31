"""
Articulation Screener - Phoneme Accuracy and Clarity Assessment
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from scipy.io import wavfile
import numpy as np
import librosa
from scipy import signal
import io

router = APIRouter()

class ArticulationAssessment(BaseModel):
    phonemes_tested: list[str]
    transcription: str
    target_utterance: str

def extract_speech_characteristics(audio_data, sr):
    """Extract characteristics relevant to articulation"""
    # Zero crossing rate (relates to fricatives and affricates)
    zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
    mean_zcr = np.mean(zcr)
    
    # Spectral features
    D = librosa.stft(audio_data)
    S = np.abs(D)
    
    # Spectral centroid (relates to consonant characteristics)
    spec_centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    mean_centroid = np.mean(spec_centroid)
    
    # MFCC features for phoneme characteristics
    mfcc = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1)
    
    return {
        'zcr': mean_zcr,
        'spectral_centroid': mean_centroid,
        'mfcc_features': mfcc_mean,
    }

def assess_consonant_clarity(audio_data, sr):
    """Assess clarity of consonant articulation"""
    characteristics = extract_speech_characteristics(audio_data, sr)
    
    # Higher ZCR indicates more fricatives/clear consonants
    zcr_clarity = min(characteristics['zcr'] * 100, 100)  # Normalize to 0-100
    
    # Spectral centroid indicates fricative presence
    centroid_score = min((characteristics['spectral_centroid'] / 5000) * 100, 100)
    
    # Combined clarity score
    clarity_score = (zcr_clarity + centroid_score) / 2
    
    return float(clarity_score)

def assess_vowel_quality(audio_data, sr):
    """Assess vowel production quality"""
    # Extract formants using LPC analysis
    hop_length = int(0.01 * sr)  # 10ms frames
    frame_length = int(0.025 * sr)  # 25ms frames
    
    # Compute power for frame-based analysis
    S = librosa.feature.melspectrogram(y=audio_data, sr=sr, hop_length=hop_length)
    power = np.sum(S, axis=0)
    
    # Find most stable frames (vowels are stable in energy)
    stable_frames = power > np.percentile(power, 30)
    stability_score = (np.sum(stable_frames) / len(power)) * 100
    
    return float(stability_score)

def calculate_articulation_rate(audio_data, sr):
    """Calculate articulation rate from audio"""
    # Detect voiced vs unvoiced
    frame_length = int(0.025 * sr)
    hop_length = int(0.010 * sr)
    
    frames = librosa.util.frame(audio_data, frame_length=frame_length, hop_length=hop_length)
    frame_energy = np.sqrt(np.sum(frames**2, axis=0))
    
    # Active speech segments
    threshold = np.mean(frame_energy) * 0.1
    active_frames = frame_energy > threshold
    
    speech_duration = np.sum(active_frames) * (hop_length / sr)
    
    # Articulation index based on zero crossings
    zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
    articulation_index = (np.sum(zcr > np.mean(zcr)) / len(zcr)) * 100
    
    return float(speech_duration), float(articulation_index)

@router.post("/articulation/screen")
async def screen_articulation(file: UploadFile = File(...), target_utterance: str = ""):
    """Screen articulation from audio file"""
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
        
        # Assess articulation components
        consonant_clarity = assess_consonant_clarity(audio_data, sr)
        vowel_quality = assess_vowel_quality(audio_data, sr)
        speech_duration, articulation_index = calculate_articulation_rate(audio_data, sr)
        
        # Overall articulation score
        overall_score = (consonant_clarity + vowel_quality) / 2
        
        return {
            "status": "success",
            "articulation_assessment": {
                "consonant_clarity_score": float(consonant_clarity),
                "vowel_quality_score": float(vowel_quality),
                "overall_articulation_score": float(overall_score),
                "articulation_index": articulation_index,
                "speech_duration_seconds": float(speech_duration),
                "sample_rate": sr,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/articulation/phoneme-test")
async def test_phoneme(file: UploadFile = File(...), phoneme: str = ""):
    """Test specific phoneme production"""
    try:
        contents = await file.read()
        audio_io = io.BytesIO(contents)
        
        audio_data, sr = librosa.load(audio_io, sr=None)
        
        clarity = assess_consonant_clarity(audio_data, sr)
        
        return {
            "status": "success",
            "phoneme": phoneme,
            "clarity_score": float(clarity),
            "production_quality": "clear" if clarity > 70 else "acceptable" if clarity > 50 else "unclear",
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

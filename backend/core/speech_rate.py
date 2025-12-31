import numpy as np
import librosa
from .audio_utils import normalize_audio

def calculate_speech_rate(y, sr, syllable_count=None, word_count=None):
    """Calculate speech rate in words per minute."""
    duration = librosa.get_duration(y=y, sr=sr)
    
    if duration == 0:
        return 0
    
    if word_count is not None:
        # If word count is provided, calculate WPM
        wpm = (word_count / duration) * 60
        return float(wpm)
    elif syllable_count is not None:
        # Estimate words from syllables (average 1.5 syllables per word)
        estimated_words = syllable_count / 1.5
        wpm = (estimated_words / duration) * 60
        return float(wpm)
    
    # Estimate from acoustic features if no counts provided
    return estimate_speech_rate_acoustic(y, sr)

def estimate_speech_rate_acoustic(y, sr):
    """Estimate speech rate from acoustic features."""
    # Get energy envelope
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    energy = np.mean(S_db, axis=0)
    
    # Find peaks (speech segments)
    threshold = np.mean(energy) + np.std(energy)
    speech_frames = np.sum(energy > threshold)
    
    frame_length = 512
    hop_length = 512
    duration = librosa.get_duration(y=y, sr=sr, L=len(energy))
    
    # Estimate speaking time vs pauses
    speaking_ratio = speech_frames / len(energy) if len(energy) > 0 else 0
    
    # Rough estimate: assume average speech has ~150 WPM
    base_wpm = 150
    adjusted_wpm = base_wpm * speaking_ratio
    
    return float(max(0, adjusted_wpm))

def calculate_pause_ratio(y, sr, threshold_db=-35):
    """Calculate ratio of pause time to total time."""
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    energy = np.mean(S_db, axis=0)
    
    # Frames below threshold are pauses
    pause_frames = np.sum(energy < threshold_db)
    total_frames = len(energy)
    
    pause_ratio = pause_frames / total_frames if total_frames > 0 else 0
    
    return float(pause_ratio)

def detect_pauses(y, sr, min_duration=0.3, threshold_db=-35):
    """Detect pause segments in speech."""
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    energy = np.mean(S_db, axis=0)
    
    # Find pause frames
    pause_mask = energy < threshold_db
    
    # Convert frame indices to time
    frame_times = librosa.frames_to_time(np.arange(len(energy)), sr=sr)
    
    # Find pause segments
    pauses = []
    in_pause = False
    pause_start = 0
    
    for i, is_pause in enumerate(pause_mask):
        if is_pause and not in_pause:
            pause_start = frame_times[i]
            in_pause = True
        elif not is_pause and in_pause:
            pause_duration = frame_times[i] - pause_start
            if pause_duration >= min_duration:
                pauses.append({
                    'start': float(pause_start),
                    'duration': float(pause_duration)
                })
            in_pause = False
    
    return pauses

def calculate_articulation_rate(y, sr, phoneme_count=None):
    """Calculate articulation rate (phonemes per second)."""
    if phoneme_count is None:
        # Estimate from acoustic features
        phoneme_count = estimate_phoneme_count(y, sr)
    
    duration = librosa.get_duration(y=y, sr=sr)
    
    if duration == 0:
        return 0
    
    articulation_rate = phoneme_count / duration
    
    return float(articulation_rate)

def estimate_phoneme_count(y, sr):
    """Estimate phoneme count from acoustic features."""
    # Get spectral flux to detect phoneme changes
    D = librosa.stft(y)
    S = np.abs(D)
    
    # Calculate spectral flux (derivative)
    flux = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))
    
    # Detect peaks in spectral flux (phoneme transitions)
    mean_flux = np.mean(flux)
    std_flux = np.std(flux)
    threshold = mean_flux + std_flux
    
    peaks = np.sum(flux > threshold)
    
    return max(10, int(peaks / 2))  # Rough estimate

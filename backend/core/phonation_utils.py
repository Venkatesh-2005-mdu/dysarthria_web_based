import numpy as np
import librosa
from .pitch_utils import extract_f0_contour
from .audio_utils import split_into_frames

def calculate_jitter(y, sr, frame_length=2048, hop_length=512):
    """Calculate jitter (pitch variation)."""
    f0 = extract_f0_contour(y, sr)
    voiced_indices = ~np.isnan(f0)
    
    if np.sum(voiced_indices) < 2:
        return 0.0
    
    voiced_f0 = f0[voiced_indices]
    periods = sr / voiced_f0
    
    # Absolute jitter
    abs_jitter = np.mean(np.abs(np.diff(periods)))
    mean_period = np.mean(periods)
    
    # Jitter percentage
    jitter_percent = (abs_jitter / mean_period) * 100 if mean_period > 0 else 0
    
    return float(jitter_percent)

def calculate_shimmer(y, sr, frame_length=2048, hop_length=512):
    """Calculate shimmer (amplitude variation)."""
    frames = split_into_frames(y, frame_length=frame_length, hop_length=hop_length)
    
    # Calculate RMS amplitude for each frame
    amplitudes = np.array([np.sqrt(np.mean(frame ** 2)) for frame in frames.T])
    
    if len(amplitudes) < 2:
        return 0.0
    
    # Absolute shimmer
    abs_shimmer = np.mean(np.abs(np.diff(amplitudes)))
    mean_amp = np.mean(amplitudes)
    
    # Shimmer percentage
    shimmer_percent = (abs_shimmer / mean_amp) * 100 if mean_amp > 0 else 0
    
    return float(shimmer_percent)

def calculate_voice_quality_metrics(y, sr):
    """Calculate comprehensive voice quality metrics."""
    jitter = calculate_jitter(y, sr)
    shimmer = calculate_shimmer(y, sr)
    
    # Noise-to-harmonics ratio estimation
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    nhr = np.std(S_db) / (np.mean(S_db) + 1e-8)
    
    return {
        'jitter': jitter,
        'shimmer': shimmer,
        'noise_harmonics_ratio': float(nhr),
        'voice_quality_score': calculate_quality_score(jitter, shimmer)
    }

def calculate_quality_score(jitter, shimmer, max_jitter=5, max_shimmer=3.5):
    """Calculate overall voice quality score (0-100)."""
    jitter_score = max(0, 100 - (jitter / max_jitter) * 100)
    shimmer_score = max(0, 100 - (shimmer / max_shimmer) * 100)
    
    quality_score = (jitter_score + shimmer_score) / 2
    return float(max(0, min(100, quality_score)))

def detect_breathiness(y, sr):
    """Detect breathiness in voice."""
    # High-frequency energy ratio
    D = librosa.stft(y)
    S = np.abs(D) ** 2
    freq = librosa.fft_frequencies(sr=sr, n_fft=len(D))
    
    # High frequencies (above 3kHz)
    high_freq_mask = freq > 3000
    low_freq_mask = freq <= 3000
    
    high_energy = np.sum(S[high_freq_mask, :])
    low_energy = np.sum(S[low_freq_mask, :])
    
    breathiness_ratio = high_energy / (low_energy + 1e-8)
    
    return float(breathiness_ratio)

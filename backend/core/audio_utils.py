import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, filtfilt
import librosa

def load_audio(audio_path):
    """Load audio file and return audio data with sample rate."""
    try:
        y, sr = librosa.load(audio_path, sr=None)
        return y, sr
    except Exception as e:
        raise Exception(f"Error loading audio: {str(e)}")

def get_audio_duration(audio_path):
    """Get duration of audio file in seconds."""
    try:
        y, sr = librosa.load(audio_path, sr=None)
        duration = librosa.get_duration(y=y, sr=sr)
        return duration
    except Exception as e:
        raise Exception(f"Error getting audio duration: {str(e)}")

def resample_audio(y, sr_original, sr_target):
    """Resample audio to target sample rate."""
    if sr_original == sr_target:
        return y
    return librosa.resample(y, orig_sr=sr_original, target_sr=sr_target)

def normalize_audio(y, target_db=-20):
    """Normalize audio to target dB level."""
    rms = np.sqrt(np.mean(y ** 2))
    if rms == 0:
        return y
    target_amplitude = 10 ** (target_db / 20)
    return y * (target_amplitude / rms)

def apply_bandpass_filter(y, sr, low_freq=80, high_freq=8000):
    """Apply bandpass filter to audio."""
    nyquist = sr / 2
    if low_freq >= nyquist or high_freq >= nyquist:
        raise ValueError(f"Filter frequencies must be below Nyquist frequency ({nyquist} Hz)")
    
    sos = butter(5, [low_freq, high_freq], btype='band', fs=sr, output='sos')
    filtered = filtfilt(sos[0], sos[1], y)
    return filtered

def get_audio_energy(y):
    """Calculate RMS energy of audio signal."""
    return np.sqrt(np.mean(y ** 2))

def get_zero_crossing_rate(y, frame_length=2048, hop_length=512):
    """Calculate zero crossing rate."""
    zcr = librosa.feature.zero_crossing_rate(y, frame_length=frame_length, hop_length=hop_length)
    return np.mean(zcr)

def split_into_frames(y, frame_length=2048, hop_length=512):
    """Split audio into overlapping frames."""
    frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
    return frames

def get_spectral_centroid(y, sr):
    """Calculate spectral centroid."""
    spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    return np.mean(spec_cent)

def get_mfcc(y, sr, n_mfcc=13):
    """Extract MFCC features."""
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
    return mfcc

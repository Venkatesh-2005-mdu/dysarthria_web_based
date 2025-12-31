import numpy as np
import librosa
from .audio_utils import normalize_audio, apply_bandpass_filter, split_into_frames

def extract_f0_contour(y, sr, method='pyin'):
    """Extract fundamental frequency (F0) contour."""
    try:
        if method == 'pyin':
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y, fmin=librosa.note_to_hz('C2'), 
                fmax=librosa.note_to_hz('C7'), sr=sr
            )
        else:
            f0 = librosa.yin(
                y, fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'), sr=sr
            )
        return f0
    except Exception as e:
        raise Exception(f"Error extracting F0: {str(e)}")

def get_mean_pitch(y, sr):
    """Get mean pitch (F0) in Hz."""
    f0 = extract_f0_contour(y, sr)
    voiced_indices = ~np.isnan(f0)
    if np.sum(voiced_indices) == 0:
        return 0
    return np.mean(f0[voiced_indices])

def get_pitch_range(y, sr):
    """Get pitch range (min and max F0)."""
    f0 = extract_f0_contour(y, sr)
    voiced_indices = ~np.isnan(f0)
    if np.sum(voiced_indices) == 0:
        return 0, 0
    voiced_f0 = f0[voiced_indices]
    return np.min(voiced_f0), np.max(voiced_f0)

def get_pitch_std(y, sr):
    """Get standard deviation of pitch."""
    f0 = extract_f0_contour(y, sr)
    voiced_indices = ~np.isnan(f0)
    if np.sum(voiced_indices) < 2:
        return 0
    return np.std(f0[voiced_indices])

def hz_to_semitones(f0_hz, reference_hz=130.81):
    """Convert Hz to semitones relative to reference frequency."""
    return 12 * np.log2(f0_hz / reference_hz)

def detect_voiced_segments(y, sr, threshold=0.03):
    """Detect voiced speech segments."""
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    energy = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    
    mean_energy = np.mean(S_db)
    voiced = np.mean(S_db, axis=0) > (mean_energy - threshold)
    return voiced

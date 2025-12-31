import numpy as np
import librosa

def simple_voice_activity_detection(y, sr, threshold_db=-40):
    """Simple voice activity detection using energy threshold."""
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    energy = np.mean(S_db, axis=0)
    
    # Frame-level VAD
    vad_frames = energy > threshold_db
    
    # Convert to time
    frame_times = librosa.frames_to_time(np.arange(len(energy)), sr=sr)
    
    # Get speech segments
    segments = []
    in_speech = False
    speech_start = 0
    
    for i, is_speech in enumerate(vad_frames):
        if is_speech and not in_speech:
            speech_start = frame_times[i]
            in_speech = True
        elif not is_speech and in_speech:
            speech_duration = frame_times[i] - speech_start
            segments.append({
                'start': float(speech_start),
                'duration': float(speech_duration)
            })
            in_speech = False
    
    return vad_frames, segments

def energy_based_vad(y, sr, threshold_percentile=30):
    """Energy-based voice activity detection."""
    frame_length = 2048
    hop_length = 512
    
    # Calculate frame energy
    D = librosa.stft(y, n_fft=frame_length, hop_length=hop_length)
    S = np.abs(D) ** 2
    energy = np.sqrt(np.sum(S, axis=0))
    
    # Calculate threshold
    threshold = np.percentile(energy, threshold_percentile)
    
    # VAD
    vad = energy > threshold
    
    return vad

def spectral_based_vad(y, sr, threshold_db=-35):
    """Spectral-based voice activity detection."""
    # Use MFCC features
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_delta = librosa.feature.delta(mfcc)
    
    # Calculate spectral centroid
    spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    spec_cent_normalized = (spec_cent - np.min(spec_cent)) / (np.max(spec_cent) - np.min(spec_cent) + 1e-8)
    
    # VAD based on spectral properties
    vad = spec_cent_normalized > 0.3
    
    return vad

def get_speech_segments_milliseconds(y, sr, method='energy'):
    """Get speech segments with millisecond precision."""
    if method == 'energy':
        vad = energy_based_vad(y, sr)
    else:
        vad, _ = simple_voice_activity_detection(y, sr)
    
    # Convert frame indices to time in milliseconds
    frame_times_ms = librosa.frames_to_time(np.arange(len(vad)), sr=sr) * 1000
    
    # Find segments
    segments = []
    in_speech = False
    speech_start_ms = 0
    
    for i, is_speech in enumerate(vad):
        if is_speech and not in_speech:
            speech_start_ms = frame_times_ms[i]
            in_speech = True
        elif not is_speech and in_speech:
            speech_duration_ms = frame_times_ms[i] - speech_start_ms
            segments.append({
                'start_ms': float(speech_start_ms),
                'duration_ms': float(speech_duration_ms)
            })
            in_speech = False
    
    return segments

def get_total_speech_duration(y, sr, method='energy'):
    """Get total speech duration in seconds."""
    segments = get_speech_segments_milliseconds(y, sr, method)
    total_duration = sum(seg['duration_ms'] for seg in segments) / 1000
    return float(total_duration)

def calculate_speech_percentage(y, sr, method='energy'):
    """Calculate percentage of audio that contains speech."""
    total_duration = librosa.get_duration(y=y, sr=sr)
    speech_duration = get_total_speech_duration(y, sr, method)
    
    if total_duration == 0:
        return 0
    
    percentage = (speech_duration / total_duration) * 100
    return float(percentage)

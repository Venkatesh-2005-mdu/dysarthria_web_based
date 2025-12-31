import numpy as np
import librosa

def calculate_nasality(y, sr):
    """Calculate nasality measure (nasal consonant presence)."""
    # Extract spectral features
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_db = librosa.power_to_db(S, ref=np.max)
    
    # Nasal consonants have specific spectral characteristics
    # Lower frequencies and anti-formant patterns
    low_freq_energy = np.mean(S_db[:10, :])
    high_freq_energy = np.mean(S_db[30:, :])
    
    # Nasal ratio
    nasality_score = low_freq_energy - high_freq_energy
    
    return float(nasality_score)

def detect_nasal_consonants(y, sr):
    """Detect presence of nasal consonants (m, n, ng)."""
    # Extract MFCC features
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    # Nasal consonants have specific MFCC patterns
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)
    
    # Check for nasality patterns in MFCCs
    nasal_indicator = np.sum(mfcc_std[0:3]) / (np.sum(mfcc_std) + 1e-8)
    
    return float(nasal_indicator)

def analyze_resonance(y, sr):
    """Analyze resonance characteristics of voice."""
    # Get formant-like information from spectral analysis
    D = librosa.stft(y)
    S = np.abs(D) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=len(D))
    
    # Calculate spectral peaks (formants)
    S_mean = np.mean(S, axis=1)
    
    # Identify peaks in frequency spectrum
    peaks = []
    for i in range(1, len(S_mean) - 1):
        if S_mean[i] > S_mean[i-1] and S_mean[i] > S_mean[i+1]:
            if S_mean[i] > np.mean(S_mean):
                peaks.append(freqs[i])
    
    # Expected formant ranges for normal voice
    f1_range = (200, 900)  # First formant
    f2_range = (700, 2300)  # Second formant
    f3_range = (1500, 3500)  # Third formant
    
    resonance_data = {
        'detected_peaks': peaks[:5],  # Top 5 peaks
        'formant_1': detect_formant(S_mean, freqs, f1_range),
        'formant_2': detect_formant(S_mean, freqs, f2_range),
        'formant_3': detect_formant(S_mean, freqs, f3_range),
    }
    
    return resonance_data

def detect_formant(S_mean, freqs, freq_range):
    """Detect formant within frequency range."""
    mask = (freqs >= freq_range[0]) & (freqs <= freq_range[1])
    if np.sum(mask) == 0:
        return None
    
    range_spectrum = S_mean[mask]
    range_freqs = freqs[mask]
    
    peak_idx = np.argmax(range_spectrum)
    formant_freq = range_freqs[peak_idx]
    formant_energy = range_spectrum[peak_idx]
    
    return {
        'frequency': float(formant_freq),
        'energy': float(formant_energy)
    }

def assess_voice_resonance_quality(y, sr):
    """Overall assessment of voice resonance quality."""
    resonance = analyze_resonance(y, sr)
    nasality = calculate_nasality(y, sr)
    
    # Calculate quality score
    # Check if formants are present
    formants_present = sum(1 for f in [resonance['formant_1'], 
                                       resonance['formant_2'], 
                                       resonance['formant_3']] if f is not None)
    
    formant_score = (formants_present / 3) * 100
    
    # Adjust for nasality (some nasality is normal, excessive is not)
    nasality_score = max(0, 100 - abs(nasality))
    
    overall_score = (formant_score + nasality_score) / 2
    
    return {
        'resonance_score': float(overall_score),
        'formant_score': float(formant_score),
        'nasality_score': float(nasality_score),
        'nasality_level': float(nasality),
        'formants': resonance
    }

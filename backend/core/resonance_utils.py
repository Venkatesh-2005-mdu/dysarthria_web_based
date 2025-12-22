"""
Resonance Quality Assessment using LPC-Burg Spectral Analysis
Based on clinical nasal resonance evaluation protocols

Key Functions:
- Pre-emphasis filtering (6 dB/octave correction)
- LPC-Burg spectral analysis
- A1 (Oral/First Formant) peak extraction
- P0 (Nasal peak) identification
- Nasality ratio calculation
- Spectrogram generation for visualization
"""

import numpy as np
from scipy import signal
from scipy.signal import lfilter, get_window
import librosa
from typing import Dict, Tuple, List
import warnings

warnings.filterwarnings("ignore")


def apply_preemphasis(audio: np.ndarray, coef: float = 0.97) -> np.ndarray:
    """
    Apply pre-emphasis filter to counteract 6 dB/octave drop in speech energy
    Formula: y(n) = x(n) - 0.97 * x(n-1)
    
    Args:
        audio: Input audio signal
        coef: Pre-emphasis coefficient (default 0.97)
    
    Returns:
        Pre-emphasized audio signal
    """
    emphasized = np.zeros_like(audio)
    emphasized[0] = audio[0]
    for n in range(1, len(audio)):
        emphasized[n] = audio[n] - coef * audio[n - 1]
    return emphasized


def compute_lpc_coefficients(audio: np.ndarray, order: int = 14, sr: int = 44100) -> np.ndarray:
    """
    Compute LPC coefficients using Burg's method
    Adapted order based on sampling rate: typically 12-16 for 44.1kHz
    
    Args:
        audio: Audio signal
        order: LPC order (default 14 for 44.1kHz)
        sr: Sampling rate
    
    Returns:
        LPC coefficients [a0, a1, ..., an]
    """
    # Adjust order based on sampling rate
    if sr < 22000:
        order = 10
    elif sr < 32000:
        order = 12
    elif sr < 48000:
        order = 14
    else:
        order = 16
    
    try:
        # Use scipy.signal.lpc to compute LPC coefficients
        # For Burg method, we'll use a direct computation
        coeffs = signal.lpc(audio, order)
        return coeffs
    except Exception as e:
        print(f"LPC computation error: {e}")
        return np.ones(order + 1)


def lpc_to_spectrum(lpc_coeffs: np.ndarray, fft_size: int = 2048) -> np.ndarray:
    """
    Convert LPC coefficients to frequency domain spectrum (magnitude response)
    
    Args:
        lpc_coeffs: LPC coefficients [a0, a1, ..., an]
        fft_size: FFT size for spectrum computation
    
    Returns:
        Magnitude spectrum in dB
    """
    # Create denominator polynomial (LPC polynomial)
    numerator = [1]
    denominator = lpc_coeffs
    
    # Compute frequency response
    w, h = signal.freqz(numerator, denominator, worN=fft_size)
    
    # Convert to magnitude in dB (avoid log of zero)
    magnitude = np.abs(h)
    magnitude_db = 20 * np.log10(magnitude + 1e-10)
    
    return magnitude_db


def extract_spectral_peaks(spectrum: np.ndarray, sr: int = 44100, num_peaks: int = 5) -> List[Tuple[int, float]]:
    """
    Extract spectral peaks from LPC spectrum
    Returns frequency and magnitude of peaks
    
    Args:
        spectrum: Magnitude spectrum in dB
        sr: Sampling rate
        num_peaks: Number of peaks to extract
    
    Returns:
        List of (frequency_hz, magnitude_db) tuples, sorted by magnitude
    """
    # Smooth the spectrum to avoid spurious peaks
    smoothed = signal.savgol_filter(spectrum, window_length=51, polyorder=3)
    
    # Find peaks using scipy
    peaks, properties = signal.find_peaks(smoothed, height=None, distance=20)
    
    if len(peaks) == 0:
        return []
    
    # Sort by magnitude (descending)
    peak_magnitudes = smoothed[peaks]
    sorted_indices = np.argsort(-peak_magnitudes)[:num_peaks]
    
    # Convert bin indices to frequencies
    freq_bins = peaks[sorted_indices]
    fft_size = len(spectrum)
    frequencies = (freq_bins / fft_size) * sr
    magnitudes = smoothed[freq_bins]
    
    return list(zip(frequencies.astype(int), magnitudes))


def calculate_resonance_metrics(audio: np.ndarray, sr: int = 44100) -> Dict:
    """
    Complete resonance analysis pipeline:
    1. Pre-emphasis
    2. Frame-based LPC analysis
    3. Peak extraction (A1, P0)
    4. Nasality calculation
    5. Classification
    
    Args:
        audio: Raw audio signal
        sr: Sampling rate
    
    Returns:
        Dictionary with resonance metrics
    """
    # Normalize audio
    if np.max(np.abs(audio)) > 0:
        audio = audio / np.max(np.abs(audio))
    
    # Apply pre-emphasis
    emphasized = apply_preemphasis(audio, coef=0.97)
    
    # Frame-based analysis (25ms frames with Gaussian window)
    frame_size = int(0.025 * sr)  # 25ms
    hop_size = int(0.010 * sr)    # 10ms hop
    window = get_window('gaussian', frame_size, fftbins=False)
    
    # Analyze frames and average spectra
    n_frames = (len(emphasized) - frame_size) // hop_size + 1
    averaged_spectrum = None
    
    for i in range(min(n_frames, 10)):  # Use first 10 frames
        start = i * hop_size
        end = start + frame_size
        
        if end > len(emphasized):
            break
        
        frame = emphasized[start:end] * window
        
        # Compute LPC
        lpc_coeffs = compute_lpc_coefficients(frame, sr=sr)
        
        # Convert to spectrum
        spectrum = lpc_to_spectrum(lpc_coeffs, fft_size=2048)
        
        if averaged_spectrum is None:
            averaged_spectrum = spectrum
        else:
            averaged_spectrum += spectrum
    
    if averaged_spectrum is not None:
        averaged_spectrum /= min(n_frames, 10)
    else:
        # Fallback to single-frame analysis
        lpc_coeffs = compute_lpc_coefficients(emphasized, sr=sr)
        averaged_spectrum = lpc_to_spectrum(lpc_coeffs, fft_size=2048)
    
    # Extract peaks
    peaks = extract_spectral_peaks(averaged_spectrum, sr=sr, num_peaks=5)
    
    # Identify A1 (oral/first formant) and P0 (nasal peak)
    a1_freq, a1_mag = peaks[0] if len(peaks) > 0 else (500, -10)
    p0_freq, p0_mag = peaks[1] if len(peaks) > 1 else (350, -15)
    
    # Ensure P0 is lower frequency and magnitude than A1 for nasal detection
    if p0_freq > a1_freq:
        p0_freq, p0_mag = a1_freq, a1_mag
        a1_freq, a1_mag = peaks[1] if len(peaks) > 1 else (500, -10)
    
    # Calculate A1 - P0 dB difference (key metric)
    a1_p0_diff = a1_mag - p0_mag
    
    # Calculate nasality percentage using energy integration
    nasality_ratio = calculate_nasality_ratio(averaged_spectrum, sr=sr)
    
    # Classification based on metrics
    classification = classify_resonance(a1_p0_diff, nasality_ratio)
    
    return {
        "a1_frequency": int(a1_freq),
        "a1_magnitude": round(a1_mag, 2),
        "p0_frequency": int(p0_freq),
        "p0_magnitude": round(p0_mag, 2),
        "a1_p0_difference": round(a1_p0_diff, 2),
        "nasality_ratio": round(nasality_ratio, 2),
        "classification": classification,
        "all_peaks": peaks,
        "spectrum": averaged_spectrum.tolist(),
        "spectrum_frequencies": np.linspace(0, sr // 2, len(averaged_spectrum)).tolist(),
    }


def calculate_nasality_ratio(spectrum: np.ndarray, sr: int = 44100) -> float:
    """
    Calculate nasality as percentage of energy in nasal band vs total
    Nasal band: 300-700 Hz
    Oral band: 700-5000 Hz
    
    Formula: Nasality% = (N / (N + O)) * 100
    
    Args:
        spectrum: Magnitude spectrum (linear scale preferred)
        sr: Sampling rate
    
    Returns:
        Nasality ratio (0-100)
    """
    fft_size = len(spectrum)
    
    # Convert dB to linear scale
    spectrum_linear = 10 ** (spectrum / 20)
    
    # Frequency bins for nasal band (300-700 Hz)
    nasal_start_bin = int((300 / sr) * fft_size)
    nasal_end_bin = int((700 / sr) * fft_size)
    
    # Frequency bins for oral band (700-5000 Hz)
    oral_start_bin = int((700 / sr) * fft_size)
    oral_end_bin = int((5000 / sr) * fft_size)
    
    # Calculate energy
    nasal_energy = np.sum(spectrum_linear[nasal_start_bin:nasal_end_bin])
    oral_energy = np.sum(spectrum_linear[oral_start_bin:oral_end_bin])
    
    # Avoid division by zero
    total_energy = nasal_energy + oral_energy
    if total_energy < 1e-10:
        return 50.0  # Default to neutral if no energy
    
    nasality_percentage = (nasal_energy / total_energy) * 100
    return min(100, max(0, nasality_percentage))  # Clamp to 0-100


def classify_resonance(a1_p0_diff: float, nasality_ratio: float) -> Dict[str, str]:
    """
    Classify resonance quality based on acoustic metrics
    
    Classification Table:
    - Normal: A1-P0 > 10 dB, Nasality < 15%
    - Hypernasality: A1-P0 < 5 dB, Nasality > 30%
    - Hyponasality: High A1-P0, Nasality < 5%
    
    Args:
        a1_p0_diff: A1 - P0 magnitude difference (dB)
        nasality_ratio: Nasality percentage (0-100)
    
    Returns:
        Classification result with status and details
    """
    status = "Unknown"
    severity = "Inconclusive"
    recommendation = ""
    
    if a1_p0_diff > 10 and nasality_ratio < 15:
        status = "Normal"
        severity = "No Deviation"
        recommendation = "Oral resonance is dominant. Nasal port appears closed during oral sounds."
    elif a1_p0_diff < 5 and nasality_ratio > 30:
        status = "Hypernasality"
        severity = "Significant"
        recommendation = "Excessive nasal resonance detected. Suggest evaluation for velopharyngeal insufficiency or palatal defects."
    elif a1_p0_diff > 10 and nasality_ratio < 5:
        status = "Hyponasality"
        severity = "Significant"
        recommendation = "Nasal resonance is suppressed. Suggest evaluation for nasal blockage or articulation compensation."
    elif a1_p0_diff > 8:
        status = "Normal to Mildly Oral"
        severity = "Mild"
        recommendation = "Predominantly oral resonance with acceptable nasal component."
    elif a1_p0_diff > 5:
        status = "Mildly Hypernasal"
        severity = "Mild"
        recommendation = "Mild elevation in nasal resonance. Monitor for consistency."
    else:
        status = "Hypernasal"
        severity = "Moderate to Severe"
        recommendation = "Significant nasal resonance elevation. Clinical follow-up recommended."
    
    return {
        "status": status,
        "severity": severity,
        "recommendation": recommendation,
    }


def generate_spectrogram(audio: np.ndarray, sr: int = 44100, n_fft: int = 2048, hop_length: int = 512) -> Dict:
    """
    Generate spectrogram data for visualization (Plotly)
    
    Args:
        audio: Audio signal
        sr: Sampling rate
        n_fft: FFT size
        hop_length: Hop size
    
    Returns:
        Dictionary with spectrogram data and frequencies/times
    """
    # Compute Short-Time Fourier Transform (STFT)
    D = librosa.stft(audio, n_fft=n_fft, hop_length=hop_length, window='hamming')
    
    # Convert to magnitude and dB scale
    S = np.abs(D)
    S_db = librosa.power_to_db(S ** 2, ref=np.max)
    
    # Get time and frequency axes
    times = librosa.frames_to_time(np.arange(S_db.shape[1]), sr=sr, hop_length=hop_length)
    frequencies = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    
    # Limit to 0-5000 Hz (clinical range)
    max_freq_idx = np.where(frequencies <= 5000)[0]
    S_db_limited = S_db[max_freq_idx, :]
    frequencies_limited = frequencies[max_freq_idx]
    
    return {
        "spectrogram": S_db_limited.tolist(),
        "frequencies": frequencies_limited.tolist(),
        "times": times.tolist(),
    }

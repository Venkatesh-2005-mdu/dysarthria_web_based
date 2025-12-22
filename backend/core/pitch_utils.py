import numpy as np
try:
    import parselmouth
except ImportError:
    # Alternative import for praat-parselmouth
    import parselmouth
import tempfile
import soundfile as sf
import librosa


def extract_pitch_and_overall_f0(wav_path):
    """
    Extract instantaneous pitch (F0) and
    compute voiced-time weighted mean F0.
    
    This uses Praat's pitch extraction algorithm.
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        dict with:
            - pitch_times: List of time stamps (seconds)
            - pitch_values: List of instantaneous F0 values (Hz)
            - overall_f0_weighted_hz: Voiced-time weighted mean F0 (Hz) or None
            - voiced_frames: Count of voiced frames
            - unvoiced_frames: Count of unvoiced frames
    """
    try:
        # Load audio into Praat
        snd = parselmouth.Sound(wav_path)
        
        # Extract pitch contour
        pitch = snd.to_pitch(
            pitch_floor=75.0,
            pitch_ceiling=600.0
        )
        
        # Instantaneous F0 values (Hz)
        pitch_vals = pitch.selected_array["frequency"]
        pitch_vals = np.nan_to_num(pitch_vals)
        
        # Corresponding time stamps (seconds)
        pitch_times = pitch.xs()
        
        # -------- Voiced frames only --------
        valid = pitch_vals > 0
        voiced_count = np.sum(valid)
        unvoiced_count = np.sum(~valid)
        
        overall_f0 = None
        if voiced_count >= 2:
            # Voiced-time weighted mean F0
            # Using trapezoidal integration over voiced segments
            overall_f0 = np.trapz(
                pitch_vals[valid],
                pitch_times[valid]
            ) / (pitch_times[valid][-1] - pitch_times[valid][0])
            
            overall_f0 = float(overall_f0)
        
        return {
            "pitch_times": pitch_times.tolist(),
            "pitch_values": pitch_vals.tolist(),
            "overall_f0_weighted_hz": overall_f0,
            "voiced_frames": int(voiced_count),
            "unvoiced_frames": int(unvoiced_count),
        }
    except Exception as e:
        print(f"Error extracting pitch: {e}")
        return {
            "pitch_times": [],
            "pitch_values": [],
            "overall_f0_weighted_hz": None,
            "voiced_frames": 0,
            "unvoiced_frames": 0,
            "error": str(e),
        }


def extract_pitch_from_float_array(audio_data: np.ndarray, sample_rate: int):
    """
    Extract pitch from float32 audio data array.
    
    Args:
        audio_data: Float32 numpy array of audio samples
        sample_rate: Sample rate in Hz
        
    Returns:
        dict with pitch metrics (see extract_pitch_and_overall_f0)
    """
    try:
        # Create temp WAV file from audio data
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_path = temp_file.name
        temp_file.close()
        
        # Write audio to temp file
        sf.write(temp_path, audio_data, sample_rate)
        
        # Extract pitch from temp file
        result = extract_pitch_and_overall_f0(temp_path)
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return result
    except Exception as e:
        print(f"Error extracting pitch from array: {e}")
        return {
            "pitch_times": [],
            "pitch_values": [],
            "overall_f0_weighted_hz": None,
            "voiced_frames": 0,
            "unvoiced_frames": 0,
            "error": str(e),
        }


def extract_shimmer_and_jitter(wav_path):
    """
    Extract local shimmer and jitter from audio using Praat's PointProcess.
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        dict with:
            - jitter_local: Local jitter (percentage)
            - shimmer_local: Local shimmer (percentage)
            - voiced_frames: Count of voiced frames
    """
    try:
        # Load audio into Praat
        snd = parselmouth.Sound(wav_path)
        
        # Create PointProcess for periodic analysis
        point_process = parselmouth.praat.call(
            snd,
            "To PointProcess (periodic, cc)",
            75.0,     # pitch floor (Hz)
            600.0     # pitch ceiling (Hz)
        )
        
        # Extract local jitter (in seconds, converted to percentage)
        jitter_local = parselmouth.praat.call(
            point_process,
            "Get jitter (local)",
            0,        # start time (0 = whole signal)
            0,        # end time (0 = whole signal)
            0.0001,   # min period (s)
            0.02,     # max period (s)
            1.3       # max period factor
        )
        
        # Extract local shimmer (linear, converted to percentage)
        shimmer_local = parselmouth.praat.call(
            [snd, point_process],
            "Get shimmer (local)",
            0,        # start time
            0,        # end time
            0.0001,   # min period
            0.02,     # max period
            1.3,      # max period factor
            1.6       # max amplitude factor
        )
        
        # Count voiced frames
        num_points = parselmouth.praat.call(point_process, "Get number of points")
        
        return {
            "jitter_local_percent": float(jitter_local) * 100,  # Convert to percentage
            "shimmer_local_percent": float(shimmer_local) * 100,  # Convert to percentage
            "voiced_frames": int(num_points),
        }
    except Exception as e:
        print(f"Error extracting shimmer and jitter: {e}")
        return {
            "jitter_local_percent": None,
            "shimmer_local_percent": None,
            "voiced_frames": 0,
            "error": str(e),
        }


def extract_shimmer_and_jitter_from_float_array(audio_data: np.ndarray, sample_rate: int):
    """
    Extract shimmer and jitter from float32 audio data array.
    
    Args:
        audio_data: Float32 numpy array of audio samples
        sample_rate: Sample rate in Hz
        
    Returns:
        dict with shimmer and jitter metrics
    """
    try:
        # Create temp WAV file from audio data
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_path = temp_file.name
        temp_file.close()
        
        # Write audio to temp file
        sf.write(temp_path, audio_data, sample_rate)
        
        # Extract shimmer and jitter from temp file
        result = extract_shimmer_and_jitter(temp_path)
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return result
    except Exception as e:
        print(f"Error extracting shimmer and jitter from array: {e}")
        return {
            "jitter_local_percent": None,
            "shimmer_local_percent": None,
            "voiced_frames": 0,
            "error": str(e),
        }


def extract_average_intensity(wav_path):
    """
    Extract average intensity from audio using RMS and pitch detection.
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        dict with:
            - average_voiced_intensity_db: Average intensity on voiced frames (dB SPL)
            - instantaneous_loudness_times: Time stamps for loudness frames
            - instantaneous_loudness_values: Loudness values for all frames (dB)
    """
    try:
        # Load audio
        snd = parselmouth.Sound(wav_path)
        samples = np.array(snd.values, dtype=np.float32)
        if len(samples.shape) > 1:
            samples = samples[0]  # Mono
        
        sr = int(snd.sampling_frequency)
        
        # Ensure samples are not empty
        if len(samples) == 0:
            return {
                "average_voiced_intensity_db": None,
                "instantaneous_loudness_times": [],
                "instantaneous_loudness_values": [],
                "error": "Empty audio",
            }
        
        # Extract pitch for voicing decisions
        pitch = snd.to_pitch(pitch_floor=75.0, pitch_ceiling=600.0)
        pitch_vals = np.nan_to_num(pitch.selected_array["frequency"]).astype(float)
        pitch_times = pitch.xs()
        
        # ---------- Instantaneous Loudness (ALL frames) ----------
        hop = max(1, int(0.01 * sr))   # 10 ms (at least 1 sample)
        win = max(2, int(0.03 * sr))   # 30 ms (at least 2 samples)
        
        # Ensure frame_length doesn't exceed signal length
        win = min(win, len(samples))
        
        rms = librosa.feature.rms(
            y=samples,
            frame_length=win,
            hop_length=hop
        )[0]
        
        rms_times = librosa.frames_to_time(
            np.arange(len(rms)), sr=sr
        )
        
        # Convert RMS → dB SPL (relative, uncalibrated)
        # Add small epsilon to avoid log(0)
        epsilon = 1e-10
        instant_loudness_db = 20 * np.log10(np.maximum(rms, epsilon) / 20e-6)
        
        # Clean invalid values
        instant_loudness_db = np.nan_to_num(
            instant_loudness_db,
            nan=0.0,
            posinf=0.0,
            neginf=0.0
        )
        
        # ---------- Frame Alignment ----------
        pitch_vals_np = np.array(pitch_vals)
        loud_db_np = np.array(instant_loudness_db)
        
        min_len = min(len(pitch_vals_np), len(loud_db_np))
        
        if min_len == 0:
            return {
                "average_voiced_intensity_db": None,
                "instantaneous_loudness_times": rms_times.tolist(),
                "instantaneous_loudness_values": instant_loudness_db.tolist(),
                "error": "No frames aligned",
            }
        
        pitch_vals_np = pitch_vals_np[:min_len]
        loud_db_np = loud_db_np[:min_len]
        
        # ---------- Average Intensity (Voiced Frames Only) ----------
        voiced_mask = pitch_vals_np > 0    # voiced decision
        
        average_voiced_intensity_db = None
        if np.any(voiced_mask):
            average_voiced_intensity_db = float(np.mean(loud_db_np[voiced_mask]))
        
        return {
            "average_voiced_intensity_db": average_voiced_intensity_db,
            "instantaneous_loudness_times": rms_times.tolist(),
            "instantaneous_loudness_values": instant_loudness_db.tolist(),
        }
    except Exception as e:
        print(f"Error extracting average intensity: {e}")
        import traceback
        traceback.print_exc()
        return {
            "average_voiced_intensity_db": None,
            "instantaneous_loudness_times": [],
            "instantaneous_loudness_values": [],
            "error": str(e),
        }


def extract_average_intensity_from_float_array(audio_data: np.ndarray, sample_rate: int):
    """
    Extract average intensity from float32 audio data array.
    
    Args:
        audio_data: Float32 numpy array of audio samples
        sample_rate: Sample rate in Hz
        
    Returns:
        dict with average intensity and loudness metrics
    """
    try:
        # Create temp WAV file from audio data
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_path = temp_file.name
        temp_file.close()
        
        # Write audio to temp file
        sf.write(temp_path, audio_data, sample_rate)
        
        # Extract intensity from temp file
        result = extract_average_intensity(temp_path)
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return result
    except Exception as e:
        print(f"Error extracting average intensity from array: {e}")
        return {
            "average_voiced_intensity_db": None,
            "instantaneous_loudness_times": [],
            "instantaneous_loudness_values": [],
            "error": str(e),
        }

def extract_hnr_and_f0(wav_path):
    """
    Extract Harmonic Noise Ratio (HNR) and fundamental frequency (F0).
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        dict with:
            - hnr_db: Harmonic Noise Ratio in dB
            - f0_hz: Fundamental frequency (mean F0 on voiced frames) in Hz
    """
    try:
        snd = parselmouth.Sound(wav_path)
        
        # Extract HNR using Praat's built-in method
        try:
            harmonicity = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            hnr_db = parselmouth.praat.call(harmonicity, "Get mean", 0, 0)
            if hnr_db is not None:
                hnr_db = float(hnr_db)
        except Exception as e:
            print(f"Warning: HNR calculation failed: {e}")
            hnr_db = None
        
        # Extract F0
        pitch = snd.to_pitch(pitch_floor=75.0, pitch_ceiling=600.0)
        pitch_vals = np.nan_to_num(pitch.selected_array["frequency"]).astype(float)
        
        # Get mean F0 on voiced frames
        valid = pitch_vals > 0
        f0_hz = None
        if np.any(valid) and np.sum(valid) >= 2:
            f0_hz = float(np.mean(pitch_vals[valid]))
        
        print(f"[HNR-F0] HNR: {hnr_db}, F0: {f0_hz}")
        
        return {
            "hnr_db": hnr_db,
            "f0_hz": f0_hz,
        }
    except Exception as e:
        print(f"Error extracting HNR and F0: {e}")
        import traceback
        traceback.print_exc()
        return {
            "hnr_db": None,
            "f0_hz": None,
            "error": str(e),
        }


def extract_hnr_and_f0_from_float_array(audio_data: np.ndarray, sample_rate: int):
    """
    Extract HNR and F0 from float32 audio data array.
    
    Args:
        audio_data: Float32 numpy array of audio samples
        sample_rate: Sample rate in Hz
        
    Returns:
        dict with HNR and F0 metrics
    """
    try:
        # Create temp WAV file from audio data
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_path = temp_file.name
        temp_file.close()
        
        # Write audio to temp file
        sf.write(temp_path, audio_data, sample_rate)
        
        # Extract HNR and F0 from temp file
        result = extract_hnr_and_f0(temp_path)
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return result
    except Exception as e:
        print(f"Error extracting HNR and F0 from array: {e}")
        return {
            "hnr_db": None,
            "f0_hz": None,
            "error": str(e),
        }
"""
Debug script to test the phonation test backend
This simulates what the frontend sends to the backend
"""

import json
import sys
import numpy as np

# Add backend to path
sys.path.insert(0, r'C:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend')

from routes.phonation_test import analyze_phonation, AudioData

# Create test audio data (2 seconds of sine wave at 48kHz)
sample_rate = 48000
duration = 2.0
t = np.linspace(0, duration, int(sample_rate * duration))
frequency = 220  # A3 note

# Generate sine wave (float32 between -1 and 1)
audio_array = 0.5 * np.sin(2 * np.pi * frequency * t).astype(np.float32)

# Convert to list (what frontend sends)
audio_data_list = audio_array.tolist()

print(f"[DEBUG] Generated test audio:")
print(f"  Sample rate: {sample_rate} Hz")
print(f"  Duration: {duration} s")
print(f"  Total samples: {len(audio_data_list)}")
print(f"  First 10 samples: {audio_data_list[:10]}")
print()

# Create AudioData object (matching frontend JSON)
test_data = AudioData(
    vowel="a",
    audio_data=audio_data_list,
    sample_rate=sample_rate
)

print("[DEBUG] Calling analyze_phonation()...")
try:
    result = analyze_phonation(test_data)
    print("[DEBUG] ✓ Success! Backend returned:")
    print(json.dumps(result, indent=2, default=str))
except Exception as e:
    print(f"[DEBUG] ✗ Error: {e}")
    import traceback
    traceback.print_exc()

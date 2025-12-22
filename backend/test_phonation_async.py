"""
Debug script to test phonation backend - Async version
"""

import asyncio
import json
import sys
import numpy as np

sys.path.insert(0, r'C:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend')

from routes.phonation_test import analyze_phonation, AudioData

async def test_backend():
    # Create test audio (2 sec sine wave at 48kHz)
    sample_rate = 48000
    duration = 2.0
    t = np.linspace(0, duration, int(sample_rate * duration))
    frequency = 220
    
    audio_array = 0.5 * np.sin(2 * np.pi * frequency * t).astype(np.float32)
    audio_data_list = audio_array.tolist()
    
    print(f"[TEST] Input audio:")
    print(f"  Sample rate: {sample_rate} Hz")
    print(f"  Duration: {duration} s")
    print(f"  Total samples: {len(audio_data_list)}")
    
    test_data = AudioData(
        vowel="a",
        audio_data=audio_data_list,
        sample_rate=sample_rate
    )
    
    print(f"\n[TEST] Calling analyze_phonation()...")
    try:
        result = await analyze_phonation(test_data)
        print(f"[TEST] ✓ Success!")
        print(f"  Vowel: {result.get('vowel')}")
        print(f"  Duration: {result.get('duration_sec')} sec")
        print(f"  Sample rate: {result.get('sampling_rate')} Hz")
        print(f"  Waveform points: {len(result.get('waveform', []))}")
        print(f"  File saved: {result.get('file_path')}")
    except Exception as e:
        print(f"[TEST] ✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_backend())

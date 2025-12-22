/**
 * Real-time Audio Capture Utility
 * Captures actual time-domain audio data during recording for live waveform display
 */

export class RealtimeAudioCapture {
  constructor(onAudioData, samplingRate = 16000) {
    this.audioContext = null;
    this.mediaStreamAudioSourceNode = null;
    this.scriptProcessorNode = null;
    this.onAudioData = onAudioData;
    this.targetSamplingRate = samplingRate;  // 16kHz target
    this.isCapturing = false;
  }

  /**
   * Start capturing real-time audio data at 16kHz
   * @param {MediaStream} stream - Audio stream from getUserMedia
   */
  async start(stream) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.mediaStreamAudioSourceNode = source;
      
      // Create script processor for raw audio samples
      // 4096 buffer size, 1 input channel, 1 output channel
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Process audio data
      this.scriptProcessorNode.onaudioprocess = (event) => {
        if (this.isCapturing) {
          const inputData = event.inputBuffer.getChannelData(0);
          // Send raw float32 samples (-1 to 1) without any conversion
          if (this.onAudioData && inputData.length > 0) {
            this.onAudioData(Array.from(inputData));
          }
        }
      };

      source.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.audioContext.destination);
      
      this.isCapturing = true;
      console.log(`Real-time audio capture started at device sample rate: ${this.audioContext.sampleRate}Hz`);
    } catch (err) {
      console.error("Error starting real-time audio capture:", err);
    }
  }

  /**
   * Stop capturing audio data
   */
  stop() {
    this.isCapturing = false;
    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
    }
    if (this.mediaStreamAudioSourceNode) {
      this.mediaStreamAudioSourceNode.disconnect();
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stop();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (err) {
        console.error("Error closing audio context:", err);
      }
      this.audioContext = null;
    }
  }
}

export default RealtimeAudioCapture;

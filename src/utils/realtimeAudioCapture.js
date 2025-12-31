/**
 * Real-time audio capture utility
 * Handles microphone access, stream management, and audio buffering
 */

class RealtimeAudioCapture {
  constructor(options = {}) {
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.isCapturing = false;
    this.audioBuffer = [];
    this.sampleRate = 44100;
    this.onDataCallback = options.onData || null;
    this.onErrorCallback = options.onError || null;
  }

  async initialize() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;

      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Create script processor for real-time analysis
      this.processor = this.audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (event) => {
        this.handleAudioData(event);
      };

      return true;
    } catch (error) {
      this.onErrorCallback?.(error);
      return false;
    }
  }

  handleAudioData(event) {
    const inputData = event.inputBuffer.getChannelData(0);
    this.audioBuffer.push(...inputData);

    if (this.onDataCallback) {
      this.onDataCallback({
        data: inputData,
        sampleRate: this.sampleRate,
        timestamp: Date.now(),
      });
    }
  }

  startCapture() {
    if (this.audioContext) {
      this.audioContext.resume();
      this.isCapturing = true;
      this.audioBuffer = [];
    }
  }

  stopCapture() {
    this.isCapturing = false;
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }

  getAudioBuffer() {
    return new Float32Array(this.audioBuffer);
  }

  getAudioBlob() {
    const buffer = this.getAudioBuffer();
    const wav = this.encodeWav(buffer);
    return new Blob([wav], { type: 'audio/wav' });
  }

  encodeWav(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const numberOfChannels = 1;
    const sampleRate = this.sampleRate;
    const bitDepth = 16;

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(
        offset,
        s < 0 ? s * 0x8000 : s * 0x7fff,
        true
      );
      offset += 2;
    }

    return buffer;
  }

  async cleanup() {
    if (this.processor) {
      this.processor.disconnect();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      await this.audioContext.close();
    }
  }

  getMetrics() {
    const buffer = this.getAudioBuffer();
    const rms = Math.sqrt(
      buffer.reduce((sum, sample) => sum + sample * sample, 0) /
        buffer.length
    );
    const peak = Math.max(...Array.from(buffer).map(Math.abs));

    return {
      duration: buffer.length / this.sampleRate,
      rms: rms,
      peak: peak,
      dbfs: 20 * Math.log10(rms + 1e-10),
    };
  }
}

export default RealtimeAudioCapture;

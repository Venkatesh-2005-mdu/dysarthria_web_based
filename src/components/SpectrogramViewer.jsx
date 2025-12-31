import { useRef, useEffect } from 'react';
import './SpectrogramViewer.css';

const SpectrogramViewer = ({ audioBuffer, height = 300, width = '100%' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.offsetWidth;
    canvas.height = height;

    // For a proper spectrogram, you would use STFT
    // This is a simplified version showing frequency content
    const data = audioBuffer.getChannelData(0);
    const fftSize = 2048;
    const numFrames = Math.floor(data.length / (fftSize / 2));

    // Create a simple frequency-based visualization
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const pixelData = imageData.data;

    for (let frameIdx = 0; frameIdx < canvas.width; frameIdx++) {
      const frameStart = frameIdx * (fftSize / 2);
      const frameData = data.slice(frameStart, frameStart + fftSize);

      // Simple DFT approximation
      const frequencies = [];
      for (let freqBin = 0; freqBin < canvas.height; freqBin++) {
        let real = 0,
          imag = 0;
        for (let i = 0; i < frameData.length; i++) {
          const phase =
            (2 * Math.PI * freqBin * i) / frameData.length;
          real += frameData[i] * Math.cos(phase);
          imag += frameData[i] * Math.sin(phase);
        }
        const magnitude = Math.sqrt(real * real + imag * imag);
        frequencies.push(magnitude);
      }

      // Normalize and map to color
      const maxMag = Math.max(...frequencies);
      for (let freqBin = 0; freqBin < canvas.height; freqBin++) {
        const normalized = frequencies[freqBin] / (maxMag + 1e-8);
        const pixelIdx = (frameIdx + freqBin * canvas.width) * 4;

        // Viridis-like color mapping
        if (normalized < 0.25) {
          pixelData[pixelIdx] = 68;
          pixelData[pixelIdx + 1] = 1;
          pixelData[pixelIdx + 2] = 84;
        } else if (normalized < 0.5) {
          pixelData[pixelIdx] = 59;
          pixelData[pixelIdx + 1] = 82;
          pixelData[pixelIdx + 2] = 139;
        } else if (normalized < 0.75) {
          pixelData[pixelIdx] = 33;
          pixelData[pixelIdx + 1] = 145;
          pixelData[pixelIdx + 2] = 140;
        } else {
          pixelData[pixelIdx] = 253;
          pixelData[pixelIdx + 1] = 231;
          pixelData[pixelIdx + 2] = 37;
        }
        pixelData[pixelIdx + 3] = 255; // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw axes labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('0 Hz', 5, canvas.height - 5);
    ctx.fillText('8 kHz', canvas.width - 40, canvas.height - 5);
  }, [audioBuffer, height]);

  return (
    <div className="spectrogram-container" style={{ width }}>
      <canvas
        ref={canvasRef}
        className="spectrogram-canvas"
        style={{ height: `${height}px` }}
      />
      <div className="spectrogram-labels">
        <span className="freq-label">Frequency</span>
        <span className="time-label">Time</span>
      </div>
    </div>
  );
};

export default SpectrogramViewer;

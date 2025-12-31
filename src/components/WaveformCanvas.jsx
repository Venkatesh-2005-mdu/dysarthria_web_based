import { useRef, useEffect } from 'react';
import './WaveformCanvas.css';

const WaveformCanvas = ({ audioBuffer, height = 200, width = '100%' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const data = audioBuffer.getChannelData(0);

    canvas.width = canvas.offsetWidth;
    canvas.height = height;

    // Draw background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const y1 = amp + min * amp;
      const y2 = amp + max * amp;

      if (i === 0) {
        ctx.moveTo(i, y1);
      } else {
        ctx.lineTo(i, y1);
        ctx.lineTo(i, y2);
      }
    }

    ctx.stroke();
  }, [audioBuffer, height]);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      style={{ width, height: `${height}px` }}
    />
  );
};

export default WaveformCanvas;

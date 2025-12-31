import { useRef, useEffect } from 'react';
import './AnnotatedWaveformCanvas.css';

const AnnotatedWaveformCanvas = ({
  audioBuffer,
  annotations = [],
  height = 250,
  width = '100%',
  onAnnotationAdd,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

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

    // Draw grid
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

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

    // Draw annotations
    const duration = audioBuffer.duration;
    annotations.forEach((annotation) => {
      const x = (annotation.time / duration) * canvas.width;

      // Draw annotation line
      ctx.strokeStyle = annotation.color || '#ffc107';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = annotation.color || '#ffc107';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(annotation.label || '', x + 5, 20);
    });
  }, [audioBuffer, annotations, height]);

  const handleCanvasClick = (e) => {
    if (!onAnnotationAdd || !audioBuffer) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * audioBuffer.duration;

    onAnnotationAdd({
      time: Math.max(0, Math.min(time, audioBuffer.duration)),
    });
  };

  return (
    <div
      ref={containerRef}
      className="annotated-waveform-container"
      style={{ width }}
    >
      <canvas
        ref={canvasRef}
        className="annotated-waveform-canvas"
        style={{ height: `${height}px`, cursor: onAnnotationAdd ? 'crosshair' : 'default' }}
        onClick={handleCanvasClick}
        title={onAnnotationAdd ? 'Click to add annotation' : 'Waveform with annotations'}
      />
    </div>
  );
};

export default AnnotatedWaveformCanvas;

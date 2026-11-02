import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../services/pdf/render';

/** Lazy-rendered page: only draws while near the viewport and frees its canvas when far away. */
export default function PdfPage({ pdf, pageNumber, scale = 1, rotation = 0, eager = false, onRendered, className = '', children }) {
  const box = useRef(null), canvas = useRef(null);
  const [visible, setVisible] = useState(eager);
  const [size, setSize] = useState(null);

  useEffect(() => {
    let dead = false;
    pdf.getPage(pageNumber).then((p) => {
      if (dead) return;
      const v = p.getViewport({ scale, rotation: (p.rotate + rotation) % 360 });
      setSize({ w: v.width, h: v.height });
    });
    return () => { dead = true; };
  }, [pdf, pageNumber, scale, rotation]);

  useEffect(() => {
    if (eager) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '500px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    const c = canvas.current;
    if (!visible || !size) { if (c) { c.width = 1; c.height = 1; } return undefined; }
    const ac = new AbortController();
    renderPage(pdf, pageNumber, { scale, rotation, canvas: c, signal: ac.signal }).then((r) => r && onRendered?.(r)).catch(() => {});
    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, size, pdf, pageNumber, scale, rotation]);

  return (
    <div ref={box} className={`relative bg-white shadow-sm ${className}`} style={size ? { width: size.w, height: size.h } : { width: 200 * scale, height: 280 * scale }}>
      <canvas ref={canvas} className="block" />
      {children}
    </div>
  );
}

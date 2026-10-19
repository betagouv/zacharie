import { useEffect, useRef, useState } from 'react';

const BARS = 32;

// Onde du micro pendant la dictée (comme un message vocal) : les barres suivent le volume en direct.
export default function DicteeWave({ stream }: { stream: MediaStream }) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    // les dernières valeurs défilent de droite à gauche
    const levels: Array<number> = Array(BARS).fill(0);
    let frame = 0;
    let lastPush = 0;
    const draw = (time: number) => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
      if (time - lastPush > 80) {
        levels.shift();
        levels.push(Math.min(1, peak * 2.5));
        lastPush = time;
        levels.forEach((level, index) => {
          const bar = barsRef.current[index];
          if (bar) bar.style.height = `${Math.max(8, level * 100)}%`;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      audioContext.close();
    };
  }, [stream]);

  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-[#E8EDFF] px-4 py-2"
      role="status"
      aria-label="Enregistrement en cours"
    >
      <span className="size-3 shrink-0 animate-pulse rounded-full bg-[#E1000F]" />
      <div className="flex h-8 flex-1 items-center gap-[3px]">
        {Array.from({ length: BARS }, (_, index) => (
          <span
            key={index}
            ref={(element) => {
              barsRef.current[index] = element;
            }}
            className="w-1 flex-1 rounded-full bg-[#000091] transition-[height] duration-75"
            style={{ height: '8%' }}
          />
        ))}
      </div>
      <span className="shrink-0 text-sm text-[#000091] tabular-nums">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_SPECTRUM_BAR_COUNT = 16;

export function useMicrophoneAnalyser(barCount = VOICE_SPECTRUM_BAR_COUNT) {
  const [levels, setLevels] = useState(() => Array(barCount).fill(0));
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const dataRef = useRef(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsActive(false);
    setLevels(Array(barCount).fill(0));
  }, [barCount]);

  const start = useCallback(async () => {
    stop();
    setError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not supported in this browser.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      await audioContext.resume();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setIsActive(true);

      const tick = () => {
        if (!analyserRef.current || !dataRef.current) return;

        analyserRef.current.getByteFrequencyData(dataRef.current);
        const data = dataRef.current;
        const sliceSize = Math.max(1, Math.floor(data.length / barCount));

        const nextLevels = Array.from({ length: barCount }, (_, index) => {
          const sliceStart = index * sliceSize;
          let sum = 0;
          for (let offset = 0; offset < sliceSize; offset += 1) {
            sum += data[sliceStart + offset] || 0;
          }
          const average = sum / sliceSize / 255;
          return Math.min(1, average * 3.2);
        });

        setLevels(nextLevels);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return true;
    } catch (err) {
      const name = err?.name || '';
      const message =
        name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow mic permission and try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not access the microphone. Please try again.';

      setError(message);
      stop();
      return false;
    }
  }, [barCount, stop]);

  useEffect(() => () => stop(), [stop]);

  const isSpeaking = levels.some((level) => level > 0.07);

  return {
    levels,
    isActive,
    isSpeaking,
    error,
    start,
    stop,
  };
}

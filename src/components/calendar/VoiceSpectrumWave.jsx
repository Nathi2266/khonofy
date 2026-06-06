import { VOICE_SPECTRUM_BAR_COUNT } from '@/hooks/useMicrophoneAnalyser';

const MIN_BAR_HEIGHT = 2;

export default function VoiceSpectrumWave({
  levels,
  listening = false,
  size = 'md',
  className = '',
  barCount = VOICE_SPECTRUM_BAR_COUNT,
}) {
  const barWidth = size === 'sm' ? 'w-[2px]' : 'w-[3px]';
  const gapClass = size === 'sm' ? 'gap-[2px]' : 'gap-[3px]';
  const containerHeight = size === 'sm' ? 'h-5' : 'h-10';
  const maxBarHeight = size === 'sm' ? 14 : 28;

  const normalizedLevels = Array.from({ length: barCount }, (_, index) => {
    const value = Array.isArray(levels) ? levels[index] || 0 : 0;
    if (!listening) return MIN_BAR_HEIGHT;
    return Math.max(MIN_BAR_HEIGHT, Math.round(value * maxBarHeight));
  });

  const isSpeaking = listening && normalizedLevels.some((height) => height > MIN_BAR_HEIGHT + 1);

  return (
    <div
      className={`flex items-center justify-center ${gapClass} ${containerHeight} ${className}`}
      aria-hidden="true"
    >
      {normalizedLevels.map((height, index) => (
        <span
          key={index}
          className={`${barWidth} rounded-full bg-current transition-[height] duration-100 ease-out ${
            listening ? (isSpeaking ? 'opacity-100' : 'opacity-50') : 'opacity-40'
          }`}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

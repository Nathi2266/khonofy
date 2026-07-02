import disc1 from '@/assets/images/disc_1.png';
import disc2 from '@/assets/images/disc_2.png';
import disc3 from '@/assets/images/disc_3.png';
import { cn } from '@/lib/utils';

const DISC_ITEMS = [
  { src: disc1, spin: 'animate-disc-spin-cw' },
  { src: disc2, spin: 'animate-disc-spin-ccw' },
  { src: disc3, spin: 'animate-disc-spin-cw' },
];

const SIZE_CLASSES = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

/**
 * Khonofy disc loader — three arcs in a row:
 * left CW, middle CCW, right CW.
 */
export default function DiscLoader({ size = 'md', className = undefined, label = 'Loading' }) {
  const dimension = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div
      className={cn('flex items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {DISC_ITEMS.map((disc, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(
            dimension,
            'shrink-0 bg-[#c10d00] dark:bg-white',
            disc.spin
          )}
          style={{
            WebkitMaskImage: `url(${disc.src})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskImage: `url(${disc.src})`,
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
          }}
        />
      ))}
    </div>
  );
}

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ThemeToggleFAB({ className = undefined, fixed = true }) {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full bg-[#c10d00] text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-[#a00b00] active:scale-95',
        fixed ? 'fixed bottom-6 right-6 z-50' : '',
        className
      )}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
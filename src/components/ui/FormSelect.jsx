import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EMPTY_VALUE = '__empty__';

const SIZE_CLASSES = {
  default: 'h-9 w-full',
  compact: 'h-7 w-auto min-w-[8rem] text-xs',
};

export default function FormSelect({
  value,
  onValueChange,
  placeholder = 'Select...',
  options = [],
  disabled = false,
  size = 'default',
  className = '',
}) {
  return (
    <Select
      value={value || EMPTY_VALUE}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('bg-background', SIZE_CLASSES[size], className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover text-popover-foreground">
        {options.map((option) => (
          <SelectItem key={option.value || EMPTY_VALUE} value={option.value || EMPTY_VALUE}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

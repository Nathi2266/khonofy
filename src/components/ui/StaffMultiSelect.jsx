import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function memberKey(member) {
  return member.id;
}

export default function StaffMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select staff...',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = value || [];
  const selectedKeys = useMemo(() => new Set(selected.map(memberKey)), [selected]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((member) => {
      const name = member.full_name || member.email || '';
      return name.toLowerCase().includes(normalizedQuery);
    });
  }, [options, query]);

  const toggleMember = (member) => {
    const key = memberKey(member);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((item) => memberKey(item) !== key));
      return;
    }
    onChange([
      ...selected,
      { id: member.id, full_name: member.full_name || member.email || '' },
    ]);
  };

  const removeMember = (event, member) => {
    event.preventDefault();
    event.stopPropagation();
    onChange(selected.filter((item) => memberKey(item) !== memberKey(member)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between bg-background px-3 py-2 font-normal hover:bg-background"
        >
          <div className="flex flex-1 flex-wrap gap-1.5 text-left">
            {selected.length === 0 ? (
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((member) => (
                <span
                  key={memberKey(member)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                >
                  {member.full_name}
                  <button
                    type="button"
                    className="rounded-sm hover:bg-background/80"
                    aria-label={`Remove ${member.full_name}`}
                    onClick={(event) => removeMember(event, member)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0 bg-popover text-popover-foreground"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search staff..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup heading="Staff">
              {filteredOptions.map((member) => {
                const isSelected = selectedKeys.has(memberKey(member));
                const label = member.full_name || member.email;
                return (
                  <CommandItem
                    key={member.id}
                    value={`${member.id}-${label}`}
                    onSelect={() => toggleMember(member)}
                    className="cursor-pointer gap-2"
                  >
                    <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {!filteredOptions.length ? (
              <CommandEmpty>No staff found.</CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

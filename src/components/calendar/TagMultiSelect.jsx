import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
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
import { DEFAULT_TAG_COLOR } from '@/utils/entryTags';

const CUSTOM_TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

function tagKey(tag) {
  return (tag.id || tag.name).toLowerCase();
}

export default function TagMultiSelect({ tags: availableTags = [], value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = value || [];
  const selectedKeys = useMemo(() => new Set(selected.map(tagKey)), [selected]);

  const filteredTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return availableTags;
    return availableTags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery));
  }, [availableTags, query]);

  const normalizedQuery = query.trim();
  const canAddCustom = normalizedQuery.length > 0
    && !availableTags.some((tag) => tag.name.toLowerCase() === normalizedQuery.toLowerCase())
    && !selected.some((tag) => tag.name.toLowerCase() === normalizedQuery.toLowerCase());

  const toggleTag = (tag) => {
    const key = tagKey(tag);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((item) => tagKey(item) !== key));
      return;
    }
    onChange([...selected, tag]);
  };

  const addCustomTag = () => {
    if (!canAddCustom) return;
    onChange([
      ...selected,
      {
        id: '',
        name: normalizedQuery,
        color: CUSTOM_TAG_COLORS[selected.length % CUSTOM_TAG_COLORS.length],
      },
    ]);
    setQuery('');
  };

  const removeTag = (event, tag) => {
    event.preventDefault();
    event.stopPropagation();
    onChange(selected.filter((item) => tagKey(item) !== tagKey(tag)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              <span className="text-sm text-muted-foreground">Select or type tags...</span>
            ) : (
              selected.map((tag) => (
                <span
                  key={tagKey(tag)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
                >
                  {tag.name}
                  <button
                    type="button"
                    className="rounded-full hover:bg-white/20"
                    aria-label={`Remove ${tag.name}`}
                    onClick={(event) => removeTag(event, tag)}
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
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover text-popover-foreground"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a tag..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {canAddCustom ? (
              <CommandGroup>
                <CommandItem
                  value={`add-${normalizedQuery}`}
                  onSelect={addCustomTag}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add &quot;{normalizedQuery}&quot;
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Available tags">
              {filteredTags.map((tag) => {
                const isSelected = selectedKeys.has(tagKey(tag));
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.id}
                    onSelect={() => toggleTag({
                      id: tag.id,
                      name: tag.name,
                      color: tag.color || DEFAULT_TAG_COLOR,
                    })}
                    className="gap-2"
                  >
                    <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
                    />
                    {tag.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {!filteredTags.length && !canAddCustom ? (
              <CommandEmpty>No tags found. Type to add your own.</CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

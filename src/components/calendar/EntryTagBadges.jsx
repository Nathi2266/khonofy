import { parseEntryTags } from '@/utils/entryTags';

export default function EntryTagBadges({ entry, prefix = '' }) {
  const tags = parseEntryTags(entry);
  if (!tags.length) return null;

  return (
    <>
      {tags.map((tag) => (
        <span
          key={`${tag.id || tag.name}`}
          className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: tag.color || '#6366f1' }}
        >
          {prefix}{tag.name}
        </span>
      ))}
    </>
  );
}

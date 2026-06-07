export const DEFAULT_TAG_COLOR = '#6366f1';

export function parseEntryTags(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.tags)) return entry.tags;
  if (!entry.tag_name) return [];

  const delimiter = entry.tag_name.includes('|') ? '|' : null;
  if (!delimiter) {
    return [{
      id: entry.tag_id || '',
      name: entry.tag_name,
      color: entry.tag_color || DEFAULT_TAG_COLOR,
    }];
  }

  const names = entry.tag_name.split('|');
  const colors = (entry.tag_color || '').split('|');
  const ids = (entry.tag_id || '').split('|');

  return names
    .filter(Boolean)
    .map((name, index) => ({
      id: ids[index] || '',
      name,
      color: colors[index] || DEFAULT_TAG_COLOR,
    }));
}

export function serializeEntryTags(tags = []) {
  if (!tags?.length) {
    return { tag_id: '', tag_name: '', tag_color: '' };
  }

  return {
    tag_id: tags.map((tag) => tag.id || '').join('|'),
    tag_name: tags.map((tag) => tag.name).join('|'),
    tag_color: tags.map((tag) => tag.color || DEFAULT_TAG_COLOR).join('|'),
  };
}

export function primaryTagColor(entryOrTags) {
  const tags = Array.isArray(entryOrTags) ? entryOrTags : parseEntryTags(entryOrTags);
  return tags[0]?.color || '';
}

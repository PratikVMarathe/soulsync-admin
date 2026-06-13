export function normalizeWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function capitalizeSegment(segment) {
  if (!segment) return '';
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function titleCaseWord(word) {
  return word
    .split(/([-'`])/)
    .map((segment, index) => (index % 2 === 1 ? segment : capitalizeSegment(segment)))
    .join('');
}

export function toTitleCase(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;

  return normalized
    .split(' ')
    .map(titleCaseWord)
    .join(' ');
}

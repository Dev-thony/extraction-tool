/** Normalize person/partnership names for display and persistence. */
export function toTitleCaseName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.toLocaleLowerCase().replace(/(^|[\s\-'’])([\p{L}\p{N}])/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase());
}

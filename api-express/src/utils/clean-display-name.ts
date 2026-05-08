export type CleanDisplayNameResult = { ok: true; value: string } | { ok: false; reason: 'invalid' };

export function cleanDisplayName(input: string): CleanDisplayNameResult {
  const trimmed = input.trim().replace(/\s+/g, ' ');

  if (trimmed.length === 0 || trimmed.length > 30) {
    return { ok: false, reason: 'invalid' };
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, value: trimmed };
}

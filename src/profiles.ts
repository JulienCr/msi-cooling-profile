export const PROFILE_COUNT = 5;
export const DEFAULT_PROFILES = [1, 2];

/** Normalizes user settings to a sorted, de-duplicated list of 1..5; empty or invalid input falls back to the default. */
export function normalizeProfiles(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PROFILES];
  const valid = raw.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= PROFILE_COUNT);
  const unique = [...new Set(valid)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_PROFILES];
}

/** Next selected profile after `current` in ascending cyclic order; the first selected one if `current` is not selected. */
export function nextProfile(current: number, selected: readonly number[]): number {
  const sorted = normalizeProfiles([...selected]);
  const later = sorted.find((n) => n > current);
  return later ?? sorted[0]!;
}

/** 13-byte CentralServer frame for CMD_CoolingWizard_ChangeProfile; `profile` is the 1-based number shown in the UI. */
export function buildSwitchFrame(profile: number): Buffer {
  if (!Number.isInteger(profile) || profile < 1 || profile > PROFILE_COUNT) throw new RangeError(`profile out of range: ${profile}`);
  return Buffer.from([0x0f, 0x27, 0, 0, 0x05, 0x03, 0x01, 0x08, 0, 0, 0x0a, 0x01, profile - 1]);
}

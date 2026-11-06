export type KeyState = { kind: "off" } | { kind: "active"; profile: number; inCycle: boolean };

/** Fan glyph in a 24x24 box: ring, hub and three blades. */
export function fanGlyph(color: string): string {
  const blade = (deg: number): string =>
    `<path transform="rotate(${deg} 12 12)" d="M12 12 C9 9 9.5 3.5 12 3.5 C14.5 3.5 15 9 12 12Z" fill="${color}"/>`;
  return `<circle cx="12" cy="12" r="10.5" fill="none" stroke="${color}" stroke-width="1.5"/>${blade(0)}${blade(120)}${blade(240)}<circle cx="12" cy="12" r="1.8" fill="#101418"/>`;
}

/** 144x144 key image as an SVG data URL. */
export function keyImage(state: KeyState): string {
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(keySvg(state))}`;
}

export function keySvg(state: KeyState): string {
  const off = state.kind === "off";
  const dim = !off && !state.inCycle;
  const accent = off ? "#5b6168" : dim ? "#8a8f96" : "#35c8ff";
  const text = off ? "—" : String(state.profile);
  const textColor = off ? "#5b6168" : dim ? "#9aa0a6" : "#ffffff";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<rect width="144" height="144" fill="#101418"/>` +
    `<g transform="translate(52 12) scale(1.6667)">${fanGlyph(accent)}</g>` +
    `<text x="72" y="122" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="76" fill="${textColor}">${text}</text>` +
    `</svg>`
  );
}

// Generates the static icons (plugin PNGs, action/category SVGs). Output is committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const sd = join(dirname(fileURLToPath(import.meta.url)), "..", "com.juliencr.msi-cooling.sdPlugin", "imgs");
mkdirSync(join(sd, "plugin"), { recursive: true });
mkdirSync(join(sd, "actions", "cycle"), { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * stride + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 0 = outside, 1 = background, 2 = fan (unit coordinates).
function inShape(u, v) {
  const radius = 0.18;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0);
  if (dx * dx + dy * dy > radius * radius) return 0;
  const x = u - 0.5;
  const y = v - 0.5;
  const r = Math.hypot(x, y);
  const sector = (2 * Math.PI) / 3;
  const local = (((Math.atan2(y, x) - r * 7) % sector) + sector) % sector;
  const blade = r > 0.06 && r < 0.3 && local < sector * 0.55;
  const ring = Math.abs(r - 0.36) < 0.022;
  return blade || ring ? 2 : 1;
}

function render(size) {
  return encodePng(size, (x, y) => {
    let bg = 0;
    let fg = 0;
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const hit = inShape((x + (sx + 0.5) / 4) / size, (y + (sy + 0.5) / 4) / size);
        if (hit > 0) bg++;
        if (hit === 2) fg++;
      }
    }
    const white = bg === 0 ? 0 : fg / bg;
    const mix = (base, top) => Math.round(base + (top - base) * white);
    return [mix(0x16, 0x35), mix(0x20, 0xc8), mix(0x2c, 0xff), Math.round((bg / 16) * 255)];
  });
}

writeFileSync(join(sd, "plugin", "marketplace.png"), render(256));
writeFileSync(join(sd, "plugin", "marketplace@2x.png"), render(512));

const blade = (deg) =>
  `<path transform="rotate(${deg} 12 12)" d="M12 12 C9 9 9.5 3.5 12 3.5 C14.5 3.5 15 9 12 12Z" fill="#ffffff"/>`;
const glyph = `<circle cx="12" cy="12" r="10.5" fill="none" stroke="#ffffff" stroke-width="1.5"/>${blade(0)}${blade(120)}${blade(240)}`;
writeFileSync(join(sd, "plugin", "category-icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">${glyph}</svg>\n`);
writeFileSync(join(sd, "actions", "cycle", "icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">${glyph}</svg>\n`);
writeFileSync(
  join(sd, "actions", "cycle", "key.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#101418"/><g transform="translate(36 36) scale(3)">${glyph}</g></svg>\n`,
);

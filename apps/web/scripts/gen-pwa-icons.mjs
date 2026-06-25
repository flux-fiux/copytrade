// Generate production PWA icon set from the brand mark using sharp.
// Run: node scripts/gen-pwa-icons.mjs   (sharp ships with Next.js)
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const BLUE = "#3b82f6";
const mark = `<polyline points="80,340 200,200 300,280 432,140" stroke="white" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// "any" — rounded square, full-bleed (browser/OS shows it as-is)
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="96" fill="${BLUE}"/>${mark}</svg>`;

// "maskable" — full-bleed background, mark scaled to the inner safe zone (~62%)
// so circular/squircle masks (Android/Huawei launchers) never clip the chart.
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${BLUE}"/><g transform="translate(256 256) scale(0.62) translate(-256 -256)">${mark}</g></svg>`;

// apple-touch — opaque square (iOS applies its own corner mask), mark padded a touch
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${BLUE}"/><g transform="translate(256 256) scale(0.74) translate(-256 -256)">${mark}</g></svg>`;

const jobs = [
  ["icon-192.png", anySvg, 192],
  ["icon-512.png", anySvg, 512],
  ["icon-maskable-192.png", maskSvg, 192],
  ["icon-maskable-512.png", maskSvg, 512],
  ["apple-touch-icon.png", appleSvg, 180],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(OUT, name));
  console.log("wrote", name, `${size}x${size}`);
}
console.log("done");

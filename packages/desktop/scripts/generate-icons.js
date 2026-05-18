#!/usr/bin/env node
/**
 * Generates all platform icon formats from assets/icon.svg:
 *   assets/icon.png        — 1024×1024 master (Linux + electron-builder)
 *   assets/icon.icns       — macOS (via iconutil)
 *   assets/icon.ico        — Windows (via png-to-ico)
 *
 * Run: node scripts/generate-icons.js
 * Requires: sharp, png-to-ico (devDependencies), iconutil (macOS built-in)
 */

const sharp = require('sharp');
// png-to-ico is ESM-only; use dynamic import
let pngToIco;
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const SVG = path.join(ASSETS, 'icon.svg');

async function main() {
  ({ default: pngToIco } = await import('png-to-ico'));
  console.log('Generating CodexSearch icons from icon.svg…\n');

  // ── 1. Master PNG 1024×1024 ──────────────────────────────────────────────
  const masterPng = path.join(ASSETS, 'icon.png');
  await sharp(SVG).resize(1024, 1024).png().toFile(masterPng);
  console.log('✓ icon.png (1024×1024)');

  // ── 2. macOS .icns via iconutil ──────────────────────────────────────────
  const icnsTmp = path.join(ASSETS, 'icon.iconset');
  fs.mkdirSync(icnsTmp, { recursive: true });

  const macSizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const size of macSizes) {
    const name = `icon_${size}x${size}.png`;
    await sharp(SVG).resize(size, size).png().toFile(path.join(icnsTmp, name));
    // @2x variants (same file, named differently)
    if (size <= 512) {
      const name2x = `icon_${size}x${size}@2x.png`;
      await sharp(SVG).resize(size * 2, size * 2).png().toFile(path.join(icnsTmp, name2x));
    }
  }

  const icnsOut = path.join(ASSETS, 'icon.icns');
  execSync(`iconutil -c icns "${icnsTmp}" -o "${icnsOut}"`);
  fs.rmSync(icnsTmp, { recursive: true });
  console.log('✓ icon.icns (macOS)');

  // ── 3. Windows .ico ──────────────────────────────────────────────────────
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(size => sharp(SVG).resize(size, size).png().toBuffer())
  );
  const icoBuffer = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), icoBuffer);
  console.log('✓ icon.ico (Windows)');

  console.log('\nAll icons generated in packages/desktop/assets/');
}

main().catch(err => { console.error(err); process.exit(1); });

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../src/public/icon/icon.svg');
const outDir = join(__dirname, '../src/public/icon');

const svg = readFileSync(svgPath, 'utf-8');

for (const size of [16, 48, 128]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const outPath = join(outDir, `${size}.png`);
  writeFileSync(outPath, pngBuffer);
  console.log(`✓ Generated ${size}.png (${pngBuffer.length} bytes)`);
}

console.log('Done!');

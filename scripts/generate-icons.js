// Rasterizes the Aloud icon SVG sources (assets/icon-source/*.svg) into the PNG
// set referenced by app.json. Run with `npm run icons` after editing any SVG.
// Dev-only: @resvg/resvg-js is a devDependency and never ships in the app bundle.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-source');
const OUT = path.join(ROOT, 'assets');

// source svg → output png → render width (px). Foreground/background/monochrome
// at 1024 (Expo's recommended adaptive-icon size); favicon stays small.
const TARGETS = [
  { svg: 'icon.svg', png: 'icon.png', size: 1024 },
  { svg: 'foreground.svg', png: 'android-icon-foreground.png', size: 1024 },
  { svg: 'background.svg', png: 'android-icon-background.png', size: 1024 },
  { svg: 'monochrome.svg', png: 'android-icon-monochrome.png', size: 1024 },
  { svg: 'icon.svg', png: 'favicon.png', size: 48 },
];

for (const { svg, png, size } of TARGETS) {
  const svgString = fs.readFileSync(path.join(SRC, svg), 'utf8');
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)', // transparent; opaque SVGs paint their own fill
  });
  const data = resvg.render().asPng();
  fs.writeFileSync(path.join(OUT, png), data);
  console.log(`✓ ${png} (${size}×${size}) from ${svg}`);
}

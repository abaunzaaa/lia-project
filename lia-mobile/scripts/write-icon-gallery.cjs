/**
 * Galería temporal para comparar el viewBox de 512 con el marco que contiene el trazo.
 * No forma parte de la app.
 */
const fs = require('fs');
const path = require('path');
const data = require('../src/components/icons/iconPaths.json');

const shift = -data.frame.min;
const side = data.frame.side;
const cards = Object.keys(data.icons)
  .sort()
  .map((name) => {
    const raw = data.icons[name];
    const fitted = raw.replace(/-?\d+(?:\.\d+)?/g, (token) => String(Number(token) + shift));
    return `<figure>
      <svg viewBox="0 0 512 512" width="48" height="48"><path d="${raw}" fill="#1d4e89"/></svg>
      <svg viewBox="0 0 ${side} ${side}" width="48" height="48"><path d="${fitted}" fill="#0f6b4c"/></svg>
      <figcaption>${name}</figcaption>
    </figure>`;
  })
  .join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>LÍA iconos</title>
<style>
  body { font: 14px sans-serif; margin: 24px; }
  p { max-width: 720px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { width: 140px; margin: 0; border: 1px solid #ddd; padding: 8px; }
  svg { background: #f4f7fb; display: block; margin-bottom: 6px; }
  figcaption { font-size: 12px; word-break: break-all; }
</style>
<p>Azul: viewBox 0 0 512 512, el que recorta. Verde: el mismo símbolo dentro de 0 0 ${side} ${side}, con el trazo corrido ${shift} unidades. Cada cuadro mide 48×48.</p>
<div class="grid">
${cards}
</div>
`;

const out = path.join(__dirname, '../icon-gallery.html');
fs.writeFileSync(out, html);
console.log(`gallery=${out} icons=${Object.keys(data.icons).length}`);

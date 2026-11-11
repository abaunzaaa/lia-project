const fs = require('fs');
const path = require('path');
const data = require('../src/components/icons/iconPaths.json');

function boundsOf(d) {
  const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g) || [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const mark = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === 'Z') {
      i += 1;
      continue;
    }
    if (token === 'M' || token === 'L') {
      cx = Number(tokens[i + 1]);
      cy = Number(tokens[i + 2]);
      mark(cx, cy);
      i += 3;
      continue;
    }
    if (token === 'Q') {
      mark(Number(tokens[i + 1]), Number(tokens[i + 2]));
      cx = Number(tokens[i + 3]);
      cy = Number(tokens[i + 4]);
      mark(cx, cy);
      i += 5;
      continue;
    }
    throw new Error(`comando no admitido: ${token}`);
  }
  return { minX, minY, maxX, maxY };
}

const outside = [];
let globalMax = 0;
let globalMin = Infinity;
for (const [name, d] of Object.entries(data.icons)) {
  const box = boundsOf(d);
  globalMax = Math.max(globalMax, box.maxX, box.maxY);
  globalMin = Math.min(globalMin, box.minX, box.minY);
  const stored = data.bottom[name];
  if (box.maxX > data.units || box.maxY > data.units || box.minX < 0 || box.minY < 0) {
    outside.push({
      name,
      minX: box.minX,
      minY: box.minY,
      maxX: Math.round(box.maxX),
      maxY: Math.round(box.maxY),
      stored,
    });
  }
}
outside.sort((a, b) => b.maxY - a.maxY);
console.log(
  JSON.stringify(
    {
      icons: Object.keys(data.icons).length,
      units: data.units,
      globalMin,
      globalMax: Math.ceil(globalMax),
      outside: outside.length,
      worst: outside.slice(0, 12),
    },
    null,
    2
  )
);

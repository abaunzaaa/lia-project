/**
 * Falla si un ícono usado por la app no tiene trazo,
 * o si algún punto queda fuera del marco cuadrado que pinta Ionicons.
 */
const fs = require('fs');
const path = require('path');
const data = require('../src/components/icons/iconPaths.json');
const component = fs.readFileSync(
  path.join(__dirname, '../src/components/icons/Ionicons.tsx'),
  'utf8'
);

function boundsOf(d) {
  const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g) || [];
  let i = 0;
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
      mark(Number(tokens[i + 1]), Number(tokens[i + 2]));
      i += 3;
      continue;
    }
    if (token === 'Q') {
      mark(Number(tokens[i + 1]), Number(tokens[i + 2]));
      mark(Number(tokens[i + 3]), Number(tokens[i + 4]));
      i += 5;
      continue;
    }
    throw new Error(`comando no admitido: ${token}`);
  }
  return { minX, minY, maxX, maxY };
}

function usedNames() {
  const root = path.join(__dirname, '../src');
  const names = new Set();
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (!entry.name.endsWith('.tsx') && !entry.name.endsWith('.ts')) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const match of text.matchAll(/name=["']([a-z0-9-]+)["']/g)) names.add(match[1]);
      for (const match of text.matchAll(/icon(?:Focused)?:\s*['"]([a-z0-9-]+)['"]/g)) names.add(match[1]);
    }
  };
  visit(root);
  return [...names];
}

const frame = data.frame;
const edge = frame.min + frame.side;
const failures = [];

if (frame.min !== frame.min || frame.side <= data.units) {
  failures.push('el marco tiene que ser un cuadrado mayor que el em de 512');
}
if (/drawHeight|transform=/.test(component)) {
  failures.push('Ionicons no debe cambiar el alto ni aplicar una transformación');
}
if (!/width: size, height: size/.test(component)) {
  failures.push('el hueco del ícono tiene que ser exactamente size');
}
if (!/viewBox=\{`0 0 \$\{side\} \$\{side\}`\}/.test(component)) {
  failures.push('el viewBox tiene que ser un cuadrado que empieza en 0');
}

for (const [name, d] of Object.entries(data.icons)) {
  if (!d.startsWith('M') || !d.endsWith('Z')) failures.push(`${name} no tiene un trazo cerrado`);
  let box;
  try {
    box = boundsOf(d);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : error}`);
    continue;
  }
  if (box.minX < frame.min || box.minY < frame.min || box.maxX > edge || box.maxY > edge) {
    failures.push(
      `${name} sale del marco (${box.minX},${box.minY})-(${box.maxX},${box.maxY})`
    );
  }
  const shift = -frame.min;
  if (
    box.minX + shift < 0 ||
    box.minY + shift < 0 ||
    box.maxX + shift > frame.side ||
    box.maxY + shift > frame.side
  ) {
    failures.push(`${name} no cabe en el cuadrado 0..${frame.side}`);
  }
}

for (const name of usedNames()) {
  if (!data.icons[name]) failures.push(`la app usa ${name} y no hay trazo`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `iconos=${Object.keys(data.icons).length} marco=${frame.min} ${frame.side} usados=ok`
);

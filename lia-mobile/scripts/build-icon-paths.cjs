/**
 * Extrae los contornos reales de Ionicons.ttf a trazos SVG.
 * El resultado no depende de que iOS registre una fuente de íconos.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const fontPath = path.join(
  root,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
);
const glyphPath = path.join(
  root,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'
);
const outPath = path.join(root, 'src/components/icons/iconPaths.json');

const ARG_WORDS = 0x0001;
const ARGS_XY = 0x0002;
const HAS_SCALE = 0x0008;
const MORE = 0x0020;
const HAS_XY_SCALE = 0x0040;
const HAS_MATRIX = 0x0080;

function u16(buf, offset) {
  return buf.readUInt16BE(offset);
}
function u32(buf, offset) {
  return buf.readUInt32BE(offset);
}
function i16(buf, offset) {
  return buf.readInt16BE(offset);
}

function tables(buf) {
  const count = u16(buf, 4);
  const list = new Map();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    list.set(buf.toString('latin1', at, at + 4), {
      off: u32(buf, at + 8),
      len: u32(buf, at + 12),
    });
  }
  return list;
}

function cmapGlyphs(buf, table) {
  const glyphs = new Map();
  const subtables = u16(buf, table.off + 2);
  for (let i = 0; i < subtables; i++) {
    const rec = table.off + 4 + i * 8;
    const sub = table.off + u32(buf, rec + 4);
    const format = u16(buf, sub);
    if (format === 4) {
      const segCount = u16(buf, sub + 6) / 2;
      const endCount = sub + 14;
      const startCount = endCount + segCount * 2 + 2;
      const idDelta = startCount + segCount * 2;
      const idRangeOffset = idDelta + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(buf, endCount + s * 2);
        const start = u16(buf, startCount + s * 2);
        if (start === 0xffff && end === 0xffff) continue;
        const delta = i16(buf, idDelta + s * 2);
        const rangeOffset = u16(buf, idRangeOffset + s * 2);
        for (let code = start; code <= end && code < 0xffff; code++) {
          let glyph = 0;
          if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
          else {
            const pos = idRangeOffset + s * 2 + rangeOffset + (code - start) * 2;
            glyph = u16(buf, pos);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) glyphs.set(code, glyph);
        }
      }
    } else if (format === 12) {
      const groups = u32(buf, sub + 12);
      let pos = sub + 16;
      for (let g = 0; g < groups; g++) {
        const start = u32(buf, pos);
        const end = u32(buf, pos + 4);
        let glyph = u32(buf, pos + 8);
        for (let code = start; code <= end; code++) glyphs.set(code, glyph++);
        pos += 12;
      }
    }
  }
  return glyphs;
}

function usedNames(glyphMap) {
  const src = path.join(root, 'src');
  const names = new Set();
  const literal = /['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx|ts)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        literal.lastIndex = 0;
        let match;
        while ((match = literal.exec(text))) {
          if (Object.prototype.hasOwnProperty.call(glyphMap, match[1])) names.add(match[1]);
        }
      }
    }
  };
  walk(src);
  return names;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function buildFont(buf) {
  const table = tables(buf);
  const head = table.get('head');
  const maxp = table.get('maxp');
  const loca = table.get('loca');
  const glyf = table.get('glyf');
  const units = u16(buf, head.off + 18);
  const numGlyphs = u16(buf, maxp.off + 4);
  const locaLong = i16(buf, head.off + 50) === 1;
  const glyphOf = cmapGlyphs(buf, table.get('cmap'));

  function span(id) {
    if (id < 0 || id >= numGlyphs) return null;
    if (locaLong) {
      const at = loca.off + id * 4;
      const start = u32(buf, at);
      const end = u32(buf, at + 4);
      if (end <= start) return null;
      return { at: glyf.off + start, end: glyf.off + end };
    }
    const at = loca.off + id * 2;
    const start = u16(buf, at) * 2;
    const end = u16(buf, at + 2) * 2;
    if (end <= start) return null;
    return { at: glyf.off + start, end: glyf.off + end };
  }

  function readSimple(at) {
    let p = at + 10;
    const contours = i16(buf, at);
    const ends = [];
    for (let i = 0; i < contours; i++) {
      ends.push(u16(buf, p));
      p += 2;
    }
    const instructionLength = u16(buf, p);
    p += 2 + instructionLength;
    const count = ends[ends.length - 1] + 1;
    const flags = [];
    while (flags.length < count) {
      const flag = buf[p++];
      flags.push(flag);
      if (flag & 8) {
        const repeat = buf[p++];
        for (let i = 0; i < repeat; i++) flags.push(flag);
      }
    }
    if (flags.length !== count) throw new Error('flag count');
    let x = 0;
    const xs = [];
    for (let i = 0; i < count; i++) {
      const flag = flags[i];
      if (flag & 2) {
        const delta = buf[p++];
        x += flag & 16 ? delta : -delta;
      } else if ((flag & 16) === 0) {
        x += i16(buf, p);
        p += 2;
      }
      xs.push(x);
    }
    let y = 0;
    const ys = [];
    for (let i = 0; i < count; i++) {
      const flag = flags[i];
      if (flag & 4) {
        const delta = buf[p++];
        y += flag & 32 ? delta : -delta;
      } else if ((flag & 32) === 0) {
        y += i16(buf, p);
        p += 2;
      }
      ys.push(y);
    }
    const points = xs.map((px, index) => ({
      x: px,
      y: ys[index],
      on: (flags[index] & 1) !== 0,
    }));
    const parts = [];
    let start = 0;
    for (const end of ends) {
      parts.push(points.slice(start, end + 1));
      start = end + 1;
    }
    return parts;
  }

  function transform(points, matrix) {
    return points.map((point) => ({
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      on: point.on,
    }));
  }

  function readGlyph(id, depth) {
    if (depth > 8) throw new Error('composite depth');
    const range = span(id);
    if (!range) return [];
    const contours = i16(buf, range.at);
    if (contours >= 0) return readSimple(range.at);
    let p = range.at + 10;
    const parts = [];
    let flags = 0;
    do {
      flags = u16(buf, p);
      const component = u16(buf, p + 2);
      p += 4;
      let dx = 0;
      let dy = 0;
      if (flags & ARG_WORDS) {
        dx = i16(buf, p);
        dy = i16(buf, p + 2);
        p += 4;
      } else {
        dx = buf.readInt8(p);
        dy = buf.readInt8(p + 1);
        p += 2;
      }
      const matrix = { a: 1, b: 0, c: 0, d: 1, e: flags & ARGS_XY ? dx : 0, f: flags & ARGS_XY ? dy : 0 };
      if ((flags & ARGS_XY) === 0) {
        throw new Error(`glyph ${id} uses point matching`);
      }
      if (flags & HAS_SCALE) {
        const scale = i16(buf, p) / 16384;
        matrix.a = scale;
        matrix.d = scale;
        p += 2;
      } else if (flags & HAS_XY_SCALE) {
        matrix.a = i16(buf, p) / 16384;
        matrix.d = i16(buf, p + 2) / 16384;
        p += 4;
      } else if (flags & HAS_MATRIX) {
        matrix.a = i16(buf, p) / 16384;
        matrix.b = i16(buf, p + 2) / 16384;
        matrix.c = i16(buf, p + 4) / 16384;
        matrix.d = i16(buf, p + 6) / 16384;
        p += 8;
      }
      for (const part of readGlyph(component, depth + 1)) {
        parts.push(transform(part, matrix));
      }
    } while (flags & MORE);
    return parts;
  }

  function contourPath(points) {
    if (points.length === 0) return '';
    const ring = points.slice();
    if (!ring[0].on) {
      if (ring[ring.length - 1].on) ring.unshift(ring.pop());
      else {
        const first = ring[0];
        const last = ring[ring.length - 1];
        ring.unshift({
          x: (first.x + last.x) / 2,
          y: (first.y + last.y) / 2,
          on: true,
        });
      }
    }
    const xy = (point) => `${round(point.x)} ${round(units - point.y)}`;
    let d = `M${xy(ring[0])}`;
    for (let i = 1; i < ring.length; i++) {
      const point = ring[i];
      if (point.on) {
        d += `L${xy(point)}`;
        continue;
      }
      const next = ring[i + 1] || ring[0];
      if (next.on) {
        d += `Q${xy(point)} ${xy(next)}`;
        if (ring[i + 1]) i += 1;
      } else {
        d += `Q${xy(point)} ${round((point.x + next.x) / 2)} ${round(units - (point.y + next.y) / 2)}`;
      }
    }
    return `${d}Z`;
  }

  function pathFor(codepoint) {
    const id = glyphOf.get(codepoint);
    if (!id) return '';
    return readGlyph(id, 0).map(contourPath).join('');
  }

  return { units, pathFor };
}

function iconFrame(icons) {
  let min = 0;
  let max = 0;
  for (const d of Object.values(icons)) {
    const tokens = d.match(/-?\d+(?:\.\d+)?/g) || [];
    for (const token of tokens) {
      const value = Number(token);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const origin = Math.floor(min) - 4;
  const side = Math.ceil(max) + 4 - origin;
  return { min: origin, side };
}

function main() {
  const font = fs.readFileSync(fontPath);
  const glyphMap = JSON.parse(fs.readFileSync(glyphPath, 'utf8'));
  const { units, pathFor } = buildFont(font);
  const names = [...usedNames(glyphMap)];
  names.sort();
  const icons = {};
  const bottom = {};
  const failures = [];
  for (const name of names) {
    const d = pathFor(glyphMap[name]);
    if (!d.startsWith('M') || !d.endsWith('Z') || d.length < 8) {
      failures.push(name);
      continue;
    }
    icons[name] = d;
    const ys = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let maxY = units;
    for (let i = 1; i < ys.length; i += 2) maxY = Math.max(maxY, ys[i]);
    bottom[name] = Math.ceil(maxY + 1);
  }
  if (failures.length > 0) {
    console.error(`empty paths: ${failures.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const payload = { units, frame: iconFrame(icons), bottom, icons };
  fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
  const bytes = fs.statSync(outPath).size;
  console.log(`icons=${names.length} units=${units} bytes=${bytes}`);
}

main();

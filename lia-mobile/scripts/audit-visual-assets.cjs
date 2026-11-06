/**
 * Static check for icon names, the single icon import, and local images.
 * Run from lia-mobile: npm run check:assets
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const glyphPath = path.join(
  root,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'
);
const vendorFont = path.join(
  root,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
);
const failures = [];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function u16(buf, offset) {
  return buf.readUInt16BE(offset);
}
function u32(buf, offset) {
  return buf.readUInt32BE(offset);
}
function i16(buf, offset) {
  return buf.readInt16BE(offset);
}

function fontTables(buf) {
  const count = u16(buf, 4);
  const list = [];
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    list.push({
      tag: buf.toString('latin1', at, at + 4),
      off: u32(buf, at + 8),
      len: u32(buf, at + 12),
    });
  }
  return list;
}

function cmapCodes(buf) {
  const table = fontTables(buf).find((item) => item.tag === 'cmap');
  if (!table) throw new Error('cmap missing');
  const base = table.off;
  const subtables = u16(buf, base + 2);
  const codes = new Set();
  for (let i = 0; i < subtables; i++) {
    const rec = base + 4 + i * 8;
    const sub = base + u32(buf, rec + 4);
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
          if (glyph !== 0) codes.add(code);
        }
      }
    } else if (format === 12) {
      const groups = u32(buf, sub + 12);
      let cursor = sub + 16;
      for (let g = 0; g < groups; g++) {
        const start = u32(buf, cursor);
        const end = u32(buf, cursor + 4);
        cursor += 12;
        for (let code = start; code <= end; code++) codes.add(code);
      }
    }
  }
  return codes;
}

function familyNames(buf) {
  const table = fontTables(buf).find((item) => item.tag === 'name');
  const count = u16(buf, table.off + 2);
  const stringOffset = u16(buf, table.off + 4);
  const names = [];
  for (let i = 0; i < count; i++) {
    const rec = table.off + 6 + i * 12;
    const platform = u16(buf, rec);
    const nameId = u16(buf, rec + 6);
    const length = u16(buf, rec + 8);
    const offset = u16(buf, rec + 10);
    if (![1, 4, 6, 16].includes(nameId)) continue;
    const raw = buf.subarray(table.off + stringOffset + offset, table.off + stringOffset + offset + length);
    let text = '';
    if (platform === 0 || platform === 3) {
      for (let c = 0; c + 1 < raw.length; c += 2) {
        text += String.fromCharCode((raw[c] << 8) | raw[c + 1]);
      }
    } else {
      text = raw.toString('latin1');
    }
    names.push(`${nameId}:${text}`);
  }
  return names;
}

const glyphs = JSON.parse(fs.readFileSync(glyphPath, 'utf8'));
const vendor = fs.readFileSync(vendorFont);
const codes = cmapCodes(vendor);
const missingGlyphs = Object.entries(glyphs).filter(([, code]) => !codes.has(code));
if (missingGlyphs.length > 0) {
  failures.push(`vendor font missing ${missingGlyphs.length} glyphs, first ${missingGlyphs[0][0]}`);
}
console.log(`vendor ionicons names=${familyNames(vendor).join(' ')}`);
console.log(`vendor glyphs=${Object.keys(glyphs).length} cmap=${codes.size}`);

const liaiconsPath = path.join(src, 'assets/fonts/liaicons.ttf');
const liaicons = fs.readFileSync(liaiconsPath);
const liaCodes = cmapCodes(liaicons);
const liaMissing = Object.entries(glyphs).filter(([, code]) => !liaCodes.has(code));
if (liaMissing.length > 0) {
  failures.push(`liaicons missing ${liaMissing.length} glyphs, first ${liaMissing[0][0]}`);
}
const liaNames = familyNames(liaicons);
if (liaNames.some((entry) => !entry.endsWith(':liaicons'))) {
  failures.push(`liaicons name table ${liaNames.join(' ')}`);
}
console.log(`liaicons names=${liaNames.join(' ')} cmap=${liaCodes.size}`);

const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
if (app.includes('liaicons') || app.includes('Fonts/Ionicons.ttf') || app.includes("fontFamily: 'ionicons'")) {
  failures.push('App.tsx still loads an icon font');
}

const iconComponent = fs.readFileSync(path.join(src, 'components/icons/Ionicons.tsx'), 'utf8');
if (!iconComponent.includes("from 'react-native-svg'") || !iconComponent.includes('iconPaths.json')) {
  failures.push('Ionicons wrapper does not draw the shared vector paths');
}
if (/fontFamily|lineHeight:\s*size|<Text/.test(iconComponent)) {
  failures.push('Ionicons wrapper still depends on a text font');
}
const pathFile = JSON.parse(
  fs.readFileSync(path.join(src, 'components/icons/iconPaths.json'), 'utf8')
);
if (!pathFile.units || !pathFile.icons) {
  failures.push('iconPaths.json is missing units or icons');
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bundled = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules/expo/bundledNativeModules.json'), 'utf8')
);
const svgVersion = packageJson.dependencies['react-native-svg'];
if (svgVersion !== bundled['react-native-svg']) {
  failures.push(
    `react-native-svg ${svgVersion} does not match Expo Go ${bundled['react-native-svg']}`
  );
}

const sourceFiles = walk(src).filter((file) => /\.(tsx|ts|jsx|js)$/.test(file));
const iconLiteral = /['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g;
const directIcon = /(?:^|[^.\w])(?:name|icon(?:Focused)?)\s*(?:=|:)\s*\{?\s*['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g;
const used = new Map();
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel !== 'src/components/icons/Ionicons.tsx' && text.includes('@expo/vector-icons')) {
    failures.push(`${rel} imports @expo/vector-icons outside the shared icon component`);
  }
  if (/fontFamily:\s*['"](?:liaicons|ionicons)['"]/.test(text)) {
    failures.push(`${rel} still draws an icon font`);
  }
  if (rel !== 'src/components/icons/Ionicons.tsx' && /from ['"]react-native-svg['"]/.test(text)) {
    failures.push(`${rel} draws vectors outside the shared icon component`);
  }
  iconLiteral.lastIndex = 0;
  let match;
  while ((match = iconLiteral.exec(text))) {
    const name = match[1];
    if (name in glyphs && !used.has(name)) used.set(name, rel);
  }
  directIcon.lastIndex = 0;
  while ((match = directIcon.exec(text))) {
    const name = match[1];
    if (!(name in glyphs)) failures.push(`${rel} uses unknown icon ${name}`);
  }
}

const missingPaths = [];
for (const [name, file] of used) {
  const d = pathFile.icons[name];
  if (typeof d !== 'string' || !d.startsWith('M') || !d.endsWith('Z')) {
    missingPaths.push(`${name} (${file})`);
  }
}
if (missingPaths.length > 0) {
  failures.push(`icon paths missing: ${missingPaths.join(', ')}`);
}
console.log(`icon names referenced=${used.size}`);

const requireImage = /require\(\s*['"](\.\.?\/[^'"]+\.(?:png|jpe?g|webp|gif))['"]\s*\)/g;
const images = [];
let heavy = 0;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  requireImage.lastIndex = 0;
  let match;
  while ((match = requireImage.exec(text))) {
    const target = path.resolve(path.dirname(file), match[1]);
    const rel = path.relative(root, target);
    if (!fs.existsSync(target)) {
      failures.push(`missing image ${rel} required by ${path.relative(root, file)}`);
      continue;
    }
    const bytes = fs.readFileSync(target);
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const gif = bytes.slice(0, 3).toString('latin1') === 'GIF';
    const webp = bytes.slice(0, 4).toString('latin1') === 'RIFF' && bytes.slice(8, 12).toString('latin1') === 'WEBP';
    if (!png && !jpeg && !gif && !webp) {
      failures.push(`unreadable image ${rel}`);
    }
    images.push(rel);
    if (bytes.length > 700000) {
      heavy += 1;
      console.log(`heavy local image ${rel} bytes=${bytes.length}`);
    }
  }
}
console.log(`local images=${new Set(images).size}`);
console.log(`heavy local images=${heavy}`);

const svgUse = sourceFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('.svg'));
console.log(`svg references=${svgUse.length}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('visual assets ok');
}

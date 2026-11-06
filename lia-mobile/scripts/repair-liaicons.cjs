/**
 * Rebuilds liaicons.ttf from the Ionicons file shipped with
 * @expo/vector-icons, keeping every glyph and renaming the family.
 * The previous rename changed the name table without updating checksums,
 * so iOS rejected the font and the private-use glyphs drew blank.
 */
const fs = require('fs');
const path = require('path');

const vendorPath = path.join(
  __dirname,
  '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
);
const outPath = path.join(__dirname, '../src/assets/fonts/liaicons.ttf');
const glyphPath = path.join(
  __dirname,
  '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'
);

const FAMILY = 'liaicons';

function u16(b, o) {
  return b.readUInt16BE(o);
}
function u32(b, o) {
  return b.readUInt32BE(o);
}
function i16(b, o) {
  return b.readInt16BE(o);
}

function checksum(buf, start, len) {
  const padded = (len + 3) & ~3;
  let sum = 0;
  for (let i = 0; i < padded; i += 4) {
    let v = 0;
    for (let k = 0; k < 4; k++) {
      const pos = start + i + k;
      const byte = i + k < len && pos < buf.length ? buf[pos] : 0;
      v = (v << 8) | byte;
    }
    sum = (sum + (v >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

function tables(buf) {
  const count = u16(buf, 4);
  const list = [];
  for (let i = 0; i < count; i++) {
    const o = 12 + i * 16;
    list.push({
      tag: buf.toString('latin1', o, o + 4),
      dir: o,
      check: u32(buf, o + 4),
      off: u32(buf, o + 8),
      len: u32(buf, o + 12),
    });
  }
  return list;
}

function decodeName(platform, raw) {
  if (platform === 0 || platform === 3) {
    let text = '';
    for (let i = 0; i + 1 < raw.length; i += 2) {
      text += String.fromCharCode((raw[i] << 8) | raw[i + 1]);
    }
    return text;
  }
  return raw.toString('latin1');
}

function writeFamily(buf, platform, offset, length) {
  if (platform === 0 || platform === 3) {
    if (length !== FAMILY.length * 2) {
      throw new Error(`UTF-16 name length ${length} cannot hold ${FAMILY}`);
    }
    for (let i = 0; i < FAMILY.length; i++) {
      buf[offset + i * 2] = 0;
      buf[offset + i * 2 + 1] = FAMILY.charCodeAt(i);
    }
    return;
  }
  if (length !== FAMILY.length) {
    throw new Error(`Mac name length ${length} cannot hold ${FAMILY}`);
  }
  buf.write(FAMILY, offset, length, 'latin1');
}

function renameFamily(buf) {
  const name = tables(buf).find((table) => table.tag === 'name');
  if (!name) throw new Error('name table missing');
  const count = u16(buf, name.off + 2);
  const stringOffset = u16(buf, name.off + 4);
  let renamed = 0;
  for (let i = 0; i < count; i++) {
    const rec = name.off + 6 + i * 12;
    const platform = u16(buf, rec);
    const nameId = u16(buf, rec + 6);
    const length = u16(buf, rec + 8);
    const offset = u16(buf, rec + 10);
    if (nameId !== 1 && nameId !== 4 && nameId !== 6) continue;
    const rawAt = name.off + stringOffset + offset;
    const current = decodeName(platform, buf.subarray(rawAt, rawAt + length));
    if (current !== 'Ionicons' && current !== FAMILY) {
      throw new Error(`Unexpected name id ${nameId}: ${current}`);
    }
    writeFamily(buf, platform, rawAt, length);
    renamed += 1;
  }
  if (renamed !== 6) throw new Error(`Renamed ${renamed} name records, expected 6`);
}

function writeTableChecksum(buf, table) {
  const sum = checksum(buf, table.off, table.len);
  buf.writeUInt32BE(sum, table.dir + 4);
  return sum;
}

function recomputeFontChecksums(buf) {
  const list = tables(buf);
  const name = list.find((table) => table.tag === 'name');
  const head = list.find((table) => table.tag === 'head');
  if (!name || !head) throw new Error('name or head table missing');

  writeTableChecksum(buf, name);
  buf.writeUInt32BE(0, head.off + 8);
  writeTableChecksum(buf, head);

  const total = checksum(buf, 0, buf.length);
  const adjustment = (0xb1b0afba - total) >>> 0;
  buf.writeUInt32BE(adjustment, head.off + 8);

  const check = checksum(buf, 0, buf.length);
  if (check !== 0xb1b0afba) {
    throw new Error(`font checksum ${check.toString(16)}`);
  }
}

function cmapCodes(buf) {
  const table = tables(buf).find((item) => item.tag === 'cmap');
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
          if (rangeOffset === 0) {
            glyph = (code + delta) & 0xffff;
          } else {
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

function assertValid(buf) {
  const list = tables(buf);
  for (const table of list) {
    if (table.tag === 'head') continue;
    const sum = checksum(buf, table.off, table.len);
    if (sum !== u32(buf, table.dir + 4)) {
      throw new Error(`${table.tag} checksum mismatch`);
    }
  }
  if (checksum(buf, 0, buf.length) !== 0xb1b0afba) {
    throw new Error('whole-font checksum mismatch');
  }
  const names = [];
  const name = list.find((table) => table.tag === 'name');
  const count = u16(buf, name.off + 2);
  const stringOffset = u16(buf, name.off + 4);
  for (let i = 0; i < count; i++) {
    const rec = name.off + 6 + i * 12;
    const nameId = u16(buf, rec + 6);
    if (nameId !== 1 && nameId !== 4 && nameId !== 6) continue;
    const platform = u16(buf, rec);
    const length = u16(buf, rec + 8);
    const offset = u16(buf, rec + 10);
    const rawAt = name.off + stringOffset + offset;
    names.push(decodeName(platform, buf.subarray(rawAt, rawAt + length)));
  }
  if (names.some((value) => value !== FAMILY)) {
    throw new Error(`family names ${names.join(',')}`);
  }
  const glyphs = JSON.parse(fs.readFileSync(glyphPath, 'utf8'));
  const codes = cmapCodes(buf);
  const missing = Object.entries(glyphs).filter(([, code]) => !codes.has(code));
  if (missing.length > 0) {
    throw new Error(`missing ${missing.length} glyphs, first ${missing[0][0]}`);
  }
  console.log(
    `liaicons ok family=${FAMILY} glyphs=${Object.keys(glyphs).length} checksum=b1b0afba`
  );
}

const original = fs.readFileSync(vendorPath);
const probe = Buffer.from(original);
recomputeFontChecksums(probe);
if (!probe.equals(original)) {
  throw new Error('checksum algorithm does not round-trip the original Ionicons font');
}

const next = Buffer.from(original);
renameFamily(next);
recomputeFontChecksums(next);
assertValid(next);
fs.writeFileSync(outPath, next);
assertValid(fs.readFileSync(outPath));

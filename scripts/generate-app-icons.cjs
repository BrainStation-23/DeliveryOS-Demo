// Generates DeliveryOS launcher/splash artwork (PNG) without external tools:
// rounded-square tile + white "D" mark, plus a padded foreground layer for
// Android adaptive icons.
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// "D" glyph bitmap (7 rows x 6 cols)
const GLYPH = [
  'XXXXX.',
  'X....X',
  'X....X',
  'X....X',
  'X....X',
  'X....X',
  'XXXXX.',
];

function drawLogo({ size, radius, bg, fg, glyphScale, outFile }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  // rounded-square background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx >= 0 && dy >= 0) {
        const cornerX = radius - dx;
        const cornerY = radius - dy;
        const inCorner = dx < radius && dy < radius;
        const inside = !inCorner || cornerX * cornerX + cornerY * cornerY <= radius * radius;
        if (inside) set(x, y, bg);
      }
    }
  }

  // glyph
  const rows = GLYPH.length;
  const cols = GLYPH[0].length;
  const cell = Math.floor((size * glyphScale) / rows);
  const glyphW = cols * cell;
  const glyphH = rows * cell;
  const originX = Math.floor((size - glyphW) / 2);
  const originY = Math.floor((size - glyphH) / 2);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (GLYPH[gy][gx] !== 'X') continue;
      for (let py = 0; py < cell; py++) {
        for (let px2 = 0; px2 < cell; px2++) {
          const x = originX + gx * cell + px2;
          const y = originY + gy * cell + py;
          if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, fg);
        }
      }
    }
  }

  fs.writeFileSync(outFile, encodePng(size, size, px));
  console.log('wrote', outFile);
}

const APPS = [
  {
    dir: 'apps/customer_app',
    // DeliveryOS customer orange (AppColors.primary 0xFFFF5200)
    bg: [255, 82, 0, 255],
  },
  {
    dir: 'apps/rider_app',
    // Rider deep navy (AppColors.primary 0xFF1E3A8A)
    bg: [30, 58, 138, 255],
  },
];
const WHITE = [255, 255, 255, 255];

for (const { dir, bg } of APPS) {
  fs.mkdirSync(`${dir}/assets`, { recursive: true });
  drawLogo({ size: 1024, radius: 220, bg, fg: WHITE, glyphScale: 0.42, outFile: `${dir}/assets/logo.png` });
  // Adaptive foreground: same mark, transparent background, extra padding
  drawLogo({ size: 1024, radius: 0, bg: [0, 0, 0, 0], fg: WHITE, glyphScale: 0.34, outFile: `${dir}/assets/logo-foreground.png` });
}

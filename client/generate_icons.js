import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate valid raw uncompressed PNG buffer
function createMinimalPng(width, height, r, g, b, a) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crcData = buf.subarray(4, 8 + len);
  const crc = crc32(crcData);
  buf.writeInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) | 0;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

// Minimal single-image ICO generator wrapping PNG
function createIcoFromPng(pngBuf, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  const directoryEntry = Buffer.alloc(16);
  directoryEntry.writeUInt8(width >= 256 ? 0 : width, 0);
  directoryEntry.writeUInt8(height >= 256 ? 0 : height, 1);
  directoryEntry.writeUInt8(0, 2); // color count
  directoryEntry.writeUInt8(0, 3); // reserved
  directoryEntry.writeUInt16LE(1, 4); // color planes
  directoryEntry.writeUInt16LE(32, 6); // bpp
  directoryEntry.writeUInt32LE(pngBuf.length, 8); // size of image data
  directoryEntry.writeUInt32LE(6 + 16, 12); // offset of image data

  return Buffer.concat([header, directoryEntry, pngBuf]);
}

console.log('Generating WhisperAI Tauri icons...');
const png32 = createMinimalPng(32, 32, 99, 102, 241, 255); // Indigo #6366F1
const png128 = createMinimalPng(128, 128, 99, 102, 241, 255);
const png256 = createMinimalPng(256, 256, 99, 102, 241, 255);
const ico = createIcoFromPng(png32, 32, 32);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png128);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png128);

console.log('Successfully generated all icons in', iconsDir);

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { decodePngPixels, pngPixelSha256 } from "./visual/png-pixel-hash.mjs";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  // De decoder vertrouwt voor lokale Playwrightscreenshots op zlib en de
  // chunkgrenzen; CRC-validatie hoort bij de browserencoder, niet bij de hash.
  return result;
}

function rgbaPng(pixels, { filter = 0, text = "", width = pixels.length / 4, height = 1 } = {}) {
  assert.equal(pixels.length, width * height * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rowBytes = width * 4;
  const scanline = Buffer.alloc((rowBytes + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const target = row * (rowBytes + 1);
    const source = row * rowBytes;
    scanline[target] = filter;
    for (let index = 0; index < rowBytes; index += 1) {
      const value = pixels[source + index];
      if (filter === 0) scanline[target + 1 + index] = value;
      else if (filter === 1) {
        const left = index >= 4 ? pixels[source + index - 4] : 0;
        scanline[target + 1 + index] = (value - left) & 0xff;
      } else throw new Error("Testencoder ondersteunt alleen None en Sub.");
    }
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    ...(text ? [chunk("tEXt", Buffer.from(text, "utf8"))] : []),
    chunk("IDAT", deflateSync(scanline)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

test("PNG-pixelhash negeert compressiecontainer, ancillary chunks en scanlinefilter", () => {
  const pixels = [255, 0, 0, 255, 0, 0, 255, 255];
  const plain = rgbaPng(pixels, { filter: 0 });
  const filtered = rgbaPng(pixels, { filter: 1, text: "andere container" });
  assert.notEqual(createHash("sha256").update(plain).digest("hex"), createHash("sha256").update(filtered).digest("hex"));
  assert.equal(pngPixelSha256(plain), pngPixelSha256(filtered));
  assert.deepEqual([...decodePngPixels(filtered).pixels], pixels);
});

test("PNG-pixelhash detecteert iedere pixelwijziging", () => {
  const original = rgbaPng([255, 0, 0, 255, 0, 0, 255, 255]);
  const changed = rgbaPng([255, 0, 0, 255, 0, 255, 0, 255]);
  assert.notEqual(pngPixelSha256(original), pngPixelSha256(changed));
});

test("PNG-pixeldecoder weigert afgebroken of niet-ondersteunde invoer", () => {
  assert.throws(() => decodePngPixels(Buffer.from("geen png")), /geen geldige PNG/);
  const interlaced = rgbaPng([0, 0, 0, 255]);
  interlaced[28] = 1;
  assert.throws(() => decodePngPixels(interlaced), /Niet-ondersteunde screenshot-PNG/);
});

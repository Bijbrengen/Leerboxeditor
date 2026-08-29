import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS_BY_COLOR_TYPE = Object.freeze({ 0: 1, 2: 3, 4: 2, 6: 4 });

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function parsePng(png) {
  const bytes = Buffer.isBuffer(png) ? png : Buffer.from(png);
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Screenshot is geen geldige PNG.");
  }
  let offset = PNG_SIGNATURE.length;
  let header = null;
  const imageChunks = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error(`Afgebroken PNG-chunk ${type}.`);
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      if (length !== 13 || header) throw new Error("PNG bevat een ongeldige IHDR.");
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      imageChunks.push(data);
    } else if (type === "IEND") {
      ended = true;
      break;
    }
    offset = dataEnd + 4;
  }
  if (!header || !imageChunks.length || !ended) throw new Error("PNG mist IHDR, IDAT of IEND.");
  return { header, compressed: Buffer.concat(imageChunks) };
}

export function decodePngPixels(png) {
  const { header, compressed } = parsePng(png);
  const channels = CHANNELS_BY_COLOR_TYPE[header.colorType];
  if (!channels || header.bitDepth !== 8 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error(
      `Niet-ondersteunde screenshot-PNG: bitDepth=${header.bitDepth}, colorType=${header.colorType}, `
      + `compression=${header.compression}, filter=${header.filter}, interlace=${header.interlace}.`
    );
  }
  const rowBytes = header.width * channels;
  const filtered = inflateSync(compressed);
  const expectedLength = (rowBytes + 1) * header.height;
  if (filtered.length !== expectedLength) {
    throw new Error(`PNG-pixeldata heeft lengte ${filtered.length}; verwacht ${expectedLength}.`);
  }
  const pixels = Buffer.allocUnsafe(rowBytes * header.height);
  let sourceOffset = 0;
  for (let row = 0; row < header.height; row += 1) {
    const filterType = filtered[sourceOffset];
    sourceOffset += 1;
    const rowOffset = row * rowBytes;
    for (let column = 0; column < rowBytes; column += 1) {
      const encoded = filtered[sourceOffset + column];
      const left = column >= channels ? pixels[rowOffset + column - channels] : 0;
      const above = row > 0 ? pixels[rowOffset + column - rowBytes] : 0;
      const upperLeft = row > 0 && column >= channels
        ? pixels[rowOffset + column - rowBytes - channels]
        : 0;
      let value;
      if (filterType === 0) value = encoded;
      else if (filterType === 1) value = encoded + left;
      else if (filterType === 2) value = encoded + above;
      else if (filterType === 3) value = encoded + Math.floor((left + above) / 2);
      else if (filterType === 4) value = encoded + paeth(left, above, upperLeft);
      else throw new Error(`Onbekend PNG-scanlinefilter ${filterType}.`);
      pixels[rowOffset + column] = value & 0xff;
    }
    sourceOffset += rowBytes;
  }
  return { ...header, channels, pixels };
}

export function pngPixelSha256(png) {
  const decoded = decodePngPixels(png);
  const descriptor = Buffer.from([
    decoded.bitDepth,
    decoded.colorType,
    decoded.channels,
    0,
    (decoded.width >>> 24) & 0xff,
    (decoded.width >>> 16) & 0xff,
    (decoded.width >>> 8) & 0xff,
    decoded.width & 0xff,
    (decoded.height >>> 24) & 0xff,
    (decoded.height >>> 16) & 0xff,
    (decoded.height >>> 8) & 0xff,
    decoded.height & 0xff
  ]);
  return createHash("sha256").update(descriptor).update(decoded.pixels).digest("hex");
}

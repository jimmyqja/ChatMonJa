const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const iconset = path.join(root, "build", "icon.iconset");
const output = path.join(root, "build", "icon.ico");
const images = [
  [16, "icon_16x16.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_256x256.png"]
].map(([size, file]) => ({ size, png: fs.readFileSync(path.join(iconset, file)) }));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = header.length + images.length * 16;
const directory = images.map(({ size, png }) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

fs.writeFileSync(output, Buffer.concat([header, ...directory, ...images.map(image => image.png)]));
console.log(`Created ${path.relative(root, output)}`);

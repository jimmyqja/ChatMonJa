const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const iconset = path.join(root, "build", "icon.iconset");
const output = path.join(root, "build", "icon.icns");
const master = path.join(root, "build", "icon-1024.png");
const sizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"]
];

fs.mkdirSync(iconset, { recursive: true });
for (const [size, file] of sizes) {
  execFileSync("sips", ["-z", String(size), String(size), master, "--out", path.join(iconset, file)], {
    stdio: "ignore"
  });
}

const entries = [
  ["icp4", "icon_16x16.png"],
  ["icp5", "icon_32x32.png"],
  ["icp6", "icon_32x32@2x.png"],
  ["ic07", "icon_128x128.png"],
  ["ic08", "icon_256x256.png"],
  ["ic09", "icon_512x512.png"],
  ["ic10", "icon_512x512@2x.png"]
].map(([type, file]) => {
  const png = fs.readFileSync(path.join(iconset, file));
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, "ascii");
  header.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([header, png]);
});

const body = Buffer.concat(entries);
const header = Buffer.alloc(8);
header.write("icns", 0, 4, "ascii");
header.writeUInt32BE(body.length + 8, 4);
fs.writeFileSync(output, Buffer.concat([header, body]));
console.log(`Created ${path.relative(root, output)}`);

const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(process.argv[2] || "");
if (!appRoot || !fs.existsSync(appRoot)) {
  throw new Error("Pass the packaged app resources directory.");
}

const forbiddenNames = new Set([".env", "auth.json", "data", "backups"]);
const requiredFiles = [
  "main.js",
  "preload.js",
  "index.html",
  "package.json",
  "assets/chatmonja-icon.png"
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (forbiddenNames.has(entry.name)) {
      throw new Error(`Private file or directory found in package: ${path.join(directory, entry.name)}`);
    }
    if (entry.isDirectory()) walk(path.join(directory, entry.name));
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(appRoot, file))) {
    throw new Error(`Required packaged file is missing: ${file}`);
  }
}

walk(appRoot);
console.log("Packaged app contains no local auth, data, backup, or .env files.");

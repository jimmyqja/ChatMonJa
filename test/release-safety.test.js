const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("share defaults contain no personal greeting or special-user data", () => {
  const main = fs.readFileSync("main.js", "utf8");

  assert.match(main, /DEFAULT_GREETINGS = Object\.freeze\(\[/);
  assert.match(main, /Wah gwaan \$\{username\}/);
  assert.match(main, /specialUsers = loadJsonFile\(specialUsersPath, \{\}\)/);
  assert.doesNotMatch(main, /jimmyqja.*greeting/i);
});

test("creator attribution is present", () => {
  const packageJson = require("../package.json");
  const html = fs.readFileSync("index.html", "utf8");

  assert.match(packageJson.author, /Elmore 'JimmyQ' Jamieson/);
  assert.match(packageJson.author, /@jimmyqja/);
  assert.match(html, /Elmore 'JimmyQ' Jamieson/);
  assert.match(html, /@jimmyqja/);
});

test("the app logo is packaged and used by the application window", () => {
  const main = fs.readFileSync("main.js", "utf8");
  const macPackaging = fs.readFileSync("scripts/package-macos.sh", "utf8");
  const windowsPackaging = fs.readFileSync("scripts/package-windows.ps1", "utf8");

  assert.ok(fs.existsSync("assets/chatmonja-icon.png"));
  assert.match(main, /APP_ICON_PATH/);
  assert.match(main, /icon: APP_ICON_PATH/);
  assert.match(main, /app\.dock\.setIcon\(APP_ICON_PATH\)/);
  assert.match(macPackaging, /ditto "\$ROOT\/assets" "\$APP_RESOURCES\/assets"/);
  assert.match(windowsPackaging, /--no-asar/);
  assert.match(windowsPackaging, /Copy-Item \(Join-Path \$Root "assets"\)/);
  assert.match(windowsPackaging, /Package verification failed/);
});

test("1.2.1 performs a one-time cleanup of pre-release personal data", () => {
  const main = fs.readFileSync("main.js", "utf8");

  assert.match(main, /shareDataResetV121/);
  assert.match(main, /greetings = getDefaultGreetings\(\)/);
  assert.match(main, /specialUsers = \{\}/);
  assert.match(main, /fs\.unlinkSync\(path\.join\(backupsPath, file\)\)/);
});

test("default Jamaican greeting presets are installed once", () => {
  const main = fs.readFileSync("main.js", "utf8");

  assert.match(main, /defaultJamaicanGreetingsV132/);
  assert.match(main, /loadJsonFile\(greetingsPath, getDefaultGreetings\(\)\)/);
  assert.match(main, /greetings\.length === 0/);
});

test("share defaults contain no creator-specific commands", () => {
  const main = fs.readFileSync("main.js", "utf8");

  assert.match(main, /DEFAULT_LIST_COMMAND = Object\.freeze/);
  assert.match(main, /name: "list"/);
  assert.match(main, /response: "Available commands: \{commands\}"/);
  assert.match(main, /defaultListCommandV133/);
  assert.match(main, /formatAvailableCommandList/);
  assert.doesNotMatch(main, /jimmyqja.*response/i);
});

test("raid out and update checks use official external services safely", () => {
  const main = fs.readFileSync("main.js", "utf8");

  assert.match(main, /RAID_SCOPE = "channel:manage:raids"/);
  assert.match(main, /https:\/\/api\.twitch\.tv\/helix\/raids/);
  assert.match(main, /from_broadcaster_id/);
  assert.match(main, /to_broadcaster_id/);
  assert.match(main, /GITHUB_RELEASES_API = "https:\/\/api\.github\.com\/repos\/jimmyqja\/ChatMonJa\/releases\?per_page=10"/);
  assert.match(main, /shell\.openExternal\(latestUpdate\.downloadUrl\)/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Commands Manager UI and secure bridge channels are included", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const preload = fs.readFileSync("preload.js", "utf8");

  assert.match(html, /id="commandsTab"/);
  assert.match(html, /id="newCommandName"/);
  assert.match(html, /id="newCommandPermissions"/);
  assert.match(html, /id="newCommandRoleEveryone"/);
  assert.match(html, /id="newCommandRoleModerator"/);
  assert.match(html, /id="newCommandRoleBroadcaster"/);
  assert.match(html, /commandRoleCheckboxes/);
  assert.match(html, /id="newCommandCooldown"/);
  assert.match(html, /id="newCommandUserCooldown"/);
  assert.match(html, /includes <code>!list<\/code> by default/);
  assert.match(html, /<code>\{commands\}<\/code>/);
  assert.match(html, /10 Jamaican greeting presets/);
  assert.match(html, /ChatMonJA v1\.3\.3/);
  assert.match(html, /<img class="brand-mark" src="assets\/chatmonja-icon\.png" alt="ChatMonJA logo">/);
  assert.doesNotMatch(html, /class="brand-mark" aria-hidden="true">CM/);
  assert.match(preload, /"add-command"/);
  assert.match(preload, /"edit-command"/);
  assert.match(preload, /"delete-command"/);
  assert.match(preload, /"toggle-command"/);
  assert.match(preload, /"commands-list"/);
});

test("embedded interface script has valid JavaScript syntax", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];

  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

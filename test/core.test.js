const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCommandRecord,
  formatCommandResponse,
  formatGreeting,
  hasCommandPermission,
  normalizeCommandRoles,
  normalizeCommandName,
  normalizeTwitchUsername,
  parseCommandMessage
} = require("../lib/core");

test("formatGreeting replaces every supported placeholder", () => {
  assert.equal(
    formatGreeting("Hi ${username}! Happy ${dayName}, ${username}.", "Jimmy", "Friday"),
    "Hi Jimmy! Happy Friday, Jimmy."
  );
});

test("normalizeTwitchUsername trims and lowercases valid names", () => {
  assert.equal(normalizeTwitchUsername("  Jimmy_Q  "), "jimmy_q");
});

test("normalizeTwitchUsername rejects unsafe or impossible names", () => {
  assert.equal(normalizeTwitchUsername("bad-name"), "");
  assert.equal(normalizeTwitchUsername("<script>"), "");
  assert.equal(normalizeTwitchUsername("a".repeat(26)), "");
  assert.equal(normalizeTwitchUsername(null), "");
});

test("command names are normalized without allowing markup or spaces", () => {
  assert.equal(normalizeCommandName(" !Socials "), "socials");
  assert.equal(normalizeCommandName("bad command"), "");
  assert.equal(normalizeCommandName("<script>"), "");
});

test("command messages split the trigger from optional arguments", () => {
  assert.deepEqual(parseCommandMessage(" !SO hello chat "), {
    name: "so",
    args: "hello chat"
  });
  assert.equal(parseCommandMessage("hello chat"), null);
});

test("command responses replace supported placeholders", () => {
  assert.equal(
    formatCommandResponse("Hi {username} in {channel}: {args} / {commands}", {
      username: "Viewer",
      channel: "streamer",
      args: "good vibes",
      commands: "!list, !socials"
    }),
    "Hi Viewer in streamer: good vibes / !list, !socials"
  );
});

test("command records enforce safe defaults and response length", () => {
  assert.deepEqual(
    createCommandRecord({ name: "!rules", response: "Be kind." }, "command-1"),
    {
      id: "command-1",
      name: "rules",
      response: "Be kind.",
      permission: "everyone",
      allowedRoles: ["everyone"],
      enabled: true,
      cooldownSeconds: 5,
      userCooldownSeconds: 15
    }
  );
  assert.equal(
    createCommandRecord({ name: "rules", response: "x".repeat(451) }, "command-2"),
    null
  );
});

test("command permissions recognize moderators and the broadcaster", () => {
  assert.equal(hasCommandPermission("everyone", {}, "viewer", "streamer"), true);
  assert.equal(hasCommandPermission("moderator", { mod: true }, "helper", "streamer"), true);
  assert.equal(hasCommandPermission("moderator", {}, "viewer", "streamer"), false);
  assert.equal(hasCommandPermission("broadcaster", {}, "streamer", "streamer"), true);
  assert.equal(hasCommandPermission("broadcaster", { mod: true }, "helper", "streamer"), false);
  assert.equal(hasCommandPermission(["moderator", "broadcaster"], { mod: true }, "helper", "streamer"), true);
  assert.equal(hasCommandPermission(["moderator", "broadcaster"], {}, "streamer", "streamer"), true);
  assert.equal(hasCommandPermission(["moderator", "broadcaster"], {}, "viewer", "streamer"), false);
});

test("command roles support checkbox-style selections", () => {
  assert.deepEqual(normalizeCommandRoles(["moderator", "broadcaster"]), ["moderator", "broadcaster"]);
  assert.deepEqual(normalizeCommandRoles(["everyone", "moderator"]), ["everyone"]);
  assert.deepEqual(
    createCommandRecord({
      name: "!mods",
      response: "Mod room.",
      allowedRoles: ["moderator", "broadcaster"]
    }, "command-roles").allowedRoles,
    ["moderator", "broadcaster"]
  );
});

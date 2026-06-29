function formatGreeting(template, username, dayName) {
  return template
    .replaceAll("${username}", username)
    .replaceAll("${dayName}", dayName);
}

function normalizeTwitchUsername(value) {
  const username = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9_]{1,25}$/.test(username) ? username : "";
}

function compareVersions(left, right) {
  const leftParts = String(left || "")
    .replace(/^v/i, "")
    .split(".")
    .map(part => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "")
    .replace(/^v/i, "")
    .split(".")
    .map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function selectUpdateAsset(assets = [], platform = process.platform) {
  const assetList = Array.isArray(assets) ? assets : [];
  const matcher = platform === "darwin"
    ? asset => /\.dmg$/i.test(asset.name || "")
    : platform === "win32"
      ? asset => /windows.*\.zip$/i.test(asset.name || "") || /win.*\.zip$/i.test(asset.name || "")
      : asset => /\.(zip|dmg)$/i.test(asset.name || "");

  return assetList.find(asset => matcher(asset) && asset.browser_download_url) || null;
}

const COMMAND_PERMISSIONS = new Set(["everyone", "moderator", "broadcaster"]);

function normalizeCommandRoles(value) {
  const rawRoles = Array.isArray(value)
    ? value
    : typeof value === "string" ? [value] : [];
  const roles = [...new Set(rawRoles.filter(role => COMMAND_PERMISSIONS.has(role)))];

  if (!roles.length) return ["everyone"];
  if (roles.includes("everyone")) return ["everyone"];
  return roles;
}

function commandRolesToLegacyPermission(roles) {
  if (roles.includes("everyone")) return "everyone";
  if (roles.includes("moderator")) return "moderator";
  if (roles.includes("broadcaster")) return "broadcaster";
  return "everyone";
}

function normalizeCommandName(value) {
  const name = typeof value === "string"
    ? value.trim().toLowerCase().replace(/^!+/, "")
    : "";
  return /^[a-z0-9][a-z0-9_-]{0,24}$/.test(name) ? name : "";
}

function parseCommandMessage(message) {
  if (typeof message !== "string") return null;

  const match = message.trim().match(/^!([^\s]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;

  const name = normalizeCommandName(match[1]);
  if (!name) return null;

  return { name, args: (match[2] || "").trim() };
}

function formatCommandResponse(template, context = {}) {
  const username = String(context.username || "");
  const channel = String(context.channel || "");
  const args = String(context.args || "");
  const commands = String(context.commands || "");

  return String(template || "")
    .replaceAll("{username}", username)
    .replaceAll("${username}", username)
    .replaceAll("{channel}", channel)
    .replaceAll("{args}", args)
    .replaceAll("{commands}", commands);
}

function normalizeCooldown(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(3600, Math.max(0, Math.round(number)));
}

function createCommandRecord(data, id) {
  const name = normalizeCommandName(data && (data.name || data.trigger));
  const response = typeof data?.response === "string" ? data.response.trim() : "";
  const allowedRoles = normalizeCommandRoles(data?.allowedRoles || data?.permission);
  const permission = commandRolesToLegacyPermission(allowedRoles);
  const safeId = typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id)
    ? id
    : "";

  if (!name || !response || response.length > 450 || !safeId) return null;

  return {
    id: safeId,
    name,
    response,
    permission,
    allowedRoles,
    enabled: data.enabled !== false,
    cooldownSeconds: normalizeCooldown(data.cooldownSeconds, 5),
    userCooldownSeconds: normalizeCooldown(data.userCooldownSeconds, 15)
  };
}

function hasCommandPermission(permissionOrRoles, tags = {}, username = "", channelName = "") {
  const allowedRoles = normalizeCommandRoles(permissionOrRoles);
  const isBroadcaster = Boolean(tags.badges?.broadcaster) ||
    String(username).toLowerCase() === String(channelName).toLowerCase();
  const isModerator = Boolean(tags.mod) || isBroadcaster;

  if (allowedRoles.includes("everyone")) return true;
  if (allowedRoles.includes("broadcaster") && isBroadcaster) return true;
  if (allowedRoles.includes("moderator") && isModerator) return true;
  return false;
}

module.exports = {
  commandRolesToLegacyPermission,
  compareVersions,
  createCommandRecord,
  formatCommandResponse,
  formatGreeting,
  hasCommandPermission,
  normalizeCommandRoles,
  normalizeCommandName,
  normalizeTwitchUsername,
  parseCommandMessage,
  selectUpdateAsset
};

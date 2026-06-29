const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const tmi = require("tmi.js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  compareVersions,
  createCommandRecord,
  formatCommandResponse,
  formatGreeting,
  hasCommandPermission,
  normalizeCommandRoles,
  normalizeTwitchUsername,
  parseCommandMessage,
  selectUpdateAsset
} = require("./lib/core");
const { validateToken } = require("./lib/twitch-auth");

app.setName("ChatMonJA");
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

// Public application metadata from the ChatMonJA Twitch Developer application.
// This identifies ChatMonJA; it is not a user credential or secret.
const TWITCH_CLIENT_ID = "pe8dpqhgroa9dcx2gnonhaj6tyjw1z";
const REQUIRED_CHAT_SCOPES = ["chat:read", "chat:edit"];
const RAID_SCOPE = "channel:manage:raids";
const TWITCH_SCOPES = [...REQUIRED_CHAT_SCOPES, RAID_SCOPE];
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const TOKEN_VALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const TOKEN_REFRESH_WINDOW_MS = 65 * 60 * 1000;
const APP_ICON_PATH = path.join(__dirname, "assets", "chatmonja-icon.png");
const GITHUB_RELEASES_API = "https://api.github.com/repos/jimmyqja/ChatMonJa/releases?per_page=10";
const DEFAULT_GREETINGS = Object.freeze([
  "Bless up ${username}, welcome in! Happy ${dayName}.",
  "Big up ${username}! Good vibes only this ${dayName}.",
  "Wah gwaan ${username}! Pull up and enjoy the stream.",
  "Welcome ${username}! One love and good energy today.",
  "Respect ${username}, nice to see you in the chat.",
  "Yow ${username}! Thanks for rolling through this ${dayName}.",
  "Greetings ${username}! Stay for the vibes and enjoy yourself.",
  "Large up ${username}! The community is glad you're here.",
  "Easy now ${username}, welcome to the stream.",
  "Blessings ${username}! Hope your ${dayName} is full of good vibes."
]);
const DEFAULT_LIST_COMMAND = Object.freeze({
  id: "default-list-command",
  name: "list",
  response: "Available commands: {commands}",
  allowedRoles: ["everyone"],
  cooldownSeconds: 10,
  userCooldownSeconds: 30
});

let mainWindow;
let client;
let loginCancelled = false;
let loginInProgress = false;
let tokenValidationTimer;
let greetingsSent = 0;
let currentDay = new Date().getDate();

const greetedUsers = new Set();
const commandLastUsed = new Map();
const commandUserLastUsed = new Map();

const legacyDataPath = path.join(__dirname, "data");
const legacyBackupsPath = path.join(__dirname, "backups");

let dataPath;
let backupsPath;
let greetingsPath;
let commandsPath;
let specialUsersPath;
let dayThemesPath;
let ignoredBotsPath;
let authPath;
let releaseStatePath;
let raidSettingsPath;
let greetings;
let commands;
let specialUsers;
let dayThemes;
let ignoredBots;
let auth;
let raidSettings;
let latestUpdate;

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function loadJsonFile(filePath, fallbackData) {
  ensureFolder(path.dirname(filePath));

  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2));
    return fallbackData;
  }
}

function saveJsonFile(filePath, data) {
  ensureFolder(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getBackupFiles() {
  ensureFolder(backupsPath);

  return fs
    .readdirSync(backupsPath)
    .filter(file => file.endsWith(".json"))
    .sort()
    .reverse();
}

function migrateLegacyFolder(source, destination) {
  if (!fs.existsSync(destination) && fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true });
  }
}

function getDefaultGreetings() {
  return [...DEFAULT_GREETINGS];
}

function getDefaultListCommand() {
  return createCommandRecord(DEFAULT_LIST_COMMAND, DEFAULT_LIST_COMMAND.id);
}

function getDefaultRaidSettings() {
  return { defaultChannel: "" };
}

function applyShareDataReset() {
  const releaseState = loadJsonFile(releaseStatePath, {});
  if (releaseState.shareDataResetV121) return;

  greetings = getDefaultGreetings();
  specialUsers = {};
  saveJsonFile(greetingsPath, greetings);
  saveJsonFile(specialUsersPath, specialUsers);

  if (fs.existsSync(backupsPath)) {
    for (const file of fs.readdirSync(backupsPath)) {
      if (file.endsWith(".json")) fs.unlinkSync(path.join(backupsPath, file));
    }
  }

  const legacyVipPath = path.join(dataPath, "vipUsers.json");
  if (fs.existsSync(legacyVipPath)) fs.unlinkSync(legacyVipPath);

  saveJsonFile(releaseStatePath, {
    ...releaseState,
    shareDataResetV121: true,
    shareDataResetV121At: new Date().toISOString()
  });
}

function applyDefaultGreetingPresets() {
  const releaseState = loadJsonFile(releaseStatePath, {});
  if (releaseState.defaultJamaicanGreetingsV132) return;

  if (!Array.isArray(greetings) || greetings.length === 0) {
    greetings = getDefaultGreetings();
    saveJsonFile(greetingsPath, greetings);
  }

  saveJsonFile(releaseStatePath, {
    ...releaseState,
    defaultJamaicanGreetingsV132: true,
    defaultJamaicanGreetingsV132At: new Date().toISOString()
  });
}

function applyDefaultListCommand() {
  const releaseState = loadJsonFile(releaseStatePath, {});
  if (releaseState.defaultListCommandV133) return;

  if (!commands.some(command => command.name === "list")) {
    const listCommand = getDefaultListCommand();
    if (listCommand) {
      commands.unshift(listCommand);
      saveJsonFile(commandsPath, commands);
    }
  }

  saveJsonFile(releaseStatePath, {
    ...releaseState,
    defaultListCommandV133: true,
    defaultListCommandV133At: new Date().toISOString()
  });
}

function initializeStorage() {
  const userDataPath = app.getPath("userData");
  dataPath = path.join(userDataPath, "data");
  backupsPath = path.join(userDataPath, "backups");
  greetingsPath = path.join(dataPath, "greetings.json");
  commandsPath = path.join(dataPath, "commands.json");
  specialUsersPath = path.join(dataPath, "specialUsers.json");
  dayThemesPath = path.join(dataPath, "dayThemes.json");
  ignoredBotsPath = path.join(dataPath, "ignoredBots.json");
  authPath = path.join(dataPath, "auth.json");
  releaseStatePath = path.join(dataPath, "releaseState.json");
  raidSettingsPath = path.join(dataPath, "raidSettings.json");

  migrateLegacyFolder(legacyDataPath, dataPath);
  migrateLegacyFolder(legacyBackupsPath, backupsPath);

  greetings = loadJsonFile(greetingsPath, getDefaultGreetings());
  const storedCommands = loadJsonFile(commandsPath, []);
  commands = (Array.isArray(storedCommands) ? storedCommands : [])
    .map(command => createCommandRecord(command, command.id || crypto.randomUUID()))
    .filter(Boolean);
  saveJsonFile(commandsPath, commands);
  specialUsers = loadJsonFile(specialUsersPath, {});
  dayThemes = loadJsonFile(dayThemesPath, {
    Tuesday: "Throwback Tuesdays! 🎶",
    Wednesday: "Reggae Wednesdays! 🇯🇲🎵",
    Thursday: "Unruly Thursdays! 🔥",
    Friday: "Dress Code Fridays! 👕👖"
  });
  ignoredBots = loadJsonFile(ignoredBotsPath, [
    "streamelements", "nightbot", "moobot", "wizebot", "phantombot",
    "coebot", "deepbot", "ankhbot", "vivbot", "stay_hydrated_bot",
    "fossabot", "pretzelrocks", "soundalerts", "cloudbot", "scorpbot",
    "mixitupbot", "snazbot", "twitchbot", "streamlabs", "botisimo"
  ]);
  raidSettings = loadJsonFile(raidSettingsPath, getDefaultRaidSettings());
  raidSettings.defaultChannel = normalizeTwitchUsername(raidSettings.defaultChannel);
  saveJsonFile(raidSettingsPath, raidSettings);
  applyShareDataReset();
  applyDefaultGreetingPresets();
  applyDefaultListCommand();
  auth = loadAuthFile();
  if (auth.accessToken) saveAuthFile();
}

function refreshAllLists() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("greetings-list", greetings);
  mainWindow.webContents.send("commands-list", commands);
  mainWindow.webContents.send("special-users-list", specialUsers);
  mainWindow.webContents.send("day-themes-list", dayThemes);
  mainWindow.webContents.send("ignored-bots-list", ignoredBots);
  mainWindow.webContents.send("raid-settings", raidSettings);
  mainWindow.webContents.send("backup-list", getBackupFiles());
  mainWindow.webContents.send("auth-status", {
    loggedIn: auth.loggedIn,
    username: auth.username,
    channelName: auth.channelName
  });
  mainWindow.webContents.send("counter", greetingsSent);
}

function getDayName() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 900,
    minWidth: 680,
    minHeight: 650,
    title: "ChatMonJA",
    backgroundColor: "#0b0d12",
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", event => event.preventDefault());

  mainWindow.loadFile("index.html");
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", async () => {
    refreshAllLists();
    setTimeout(() => checkForUpdates(false), 1500);

    if (auth.loggedIn) {
      await startBot();
    }
  });
}

function log(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log", message);
  }
}

function status(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status", message);
  }
}

function emptyAuth() {
  return {
    userId: "",
    username: "",
    channelName: "",
    accessToken: "",
    refreshToken: "",
    expiresAt: null,
    loggedIn: false
  };
}

function loadAuthFile() {
  const stored = loadJsonFile(authPath, emptyAuth());

  if (stored.encryptedTokens) {
    try {
      const decrypted = safeStorage.decryptString(
        Buffer.from(stored.encryptedTokens, "base64")
      );
      const tokens = JSON.parse(decrypted);
      return {
        userId: stored.userId || "",
        username: stored.username || "",
        channelName: stored.channelName || "",
        accessToken: tokens.accessToken || "",
        refreshToken: tokens.refreshToken || "",
        expiresAt: stored.expiresAt || null,
        loggedIn: Boolean(stored.loggedIn && tokens.accessToken)
      };
    } catch (error) {
      return emptyAuth();
    }
  }

  return {
    userId: stored.userId || "",
    username: stored.username || "",
    channelName: stored.channelName || "",
    accessToken: stored.accessToken || "",
    refreshToken: stored.refreshToken || "",
    expiresAt: stored.expiresAt || null,
    loggedIn: Boolean(stored.loggedIn && stored.accessToken)
  };
}

function saveAuthFile() {
  const stored = {
    userId: auth.userId,
    username: auth.username,
    channelName: auth.channelName,
    expiresAt: auth.expiresAt,
    loggedIn: auth.loggedIn
  };

  if (auth.accessToken && safeStorage.isEncryptionAvailable()) {
    stored.encryptedTokens = safeStorage.encryptString(JSON.stringify({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken
    })).toString("base64");
  } else {
    stored.accessToken = auth.accessToken;
    stored.refreshToken = auth.refreshToken;
  }

  saveJsonFile(authPath, stored);
}

function isClientIdConfigured() {
  return TWITCH_CLIENT_ID && TWITCH_CLIENT_ID !== "APP_CLIENT_ID";
}

function sendLoginProgress(pending, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("login-progress", { pending, message });
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function getTwitchUser(accessToken, clientId, login = "") {
  const url = new URL("https://api.twitch.tv/helix/users");
  const normalizedLogin = normalizeTwitchUsername(login);
  if (normalizedLogin) url.searchParams.set("login", normalizedLogin);

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Client-Id": clientId
    }
  });

  if (!response.ok) {
    throw new Error("Could not get Twitch user info.");
  }

  const data = await response.json();

  if (!data.data || !data.data[0]) {
    throw new Error("No Twitch user found.");
  }

  return data.data[0];
}

async function ensureAuthUserId() {
  if (auth.userId) return auth.userId;

  const twitchUser = await getTwitchUser(auth.accessToken, TWITCH_CLIENT_ID);
  auth.userId = twitchUser.id || "";
  auth.username = twitchUser.login || auth.username;
  auth.channelName = auth.channelName || twitchUser.login || auth.username;
  saveAuthFile();

  return auth.userId;
}

async function requestDeviceAuthorization() {
  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    scopes: TWITCH_SCOPES.join(" ")
  });
  const response = await fetch("https://id.twitch.tv/oauth2/device", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json();

  if (!response.ok || !data.device_code || !data.verification_uri) {
    throw new Error(data.message || "Twitch did not start device login.");
  }

  return data;
}

async function pollForDeviceToken(deviceAuthorization) {
  let intervalSeconds = Math.max(Number(deviceAuthorization.interval) || 5, 1);
  const deadline = Date.now() + Number(deviceAuthorization.expires_in || 600) * 1000;

  while (!loginCancelled && Date.now() < deadline) {
    await wait(intervalSeconds * 1000);
    if (loginCancelled) throw new Error("Login cancelled.");

    const body = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      scopes: TWITCH_SCOPES.join(" "),
      device_code: deviceAuthorization.device_code,
      grant_type: DEVICE_GRANT_TYPE
    });
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await response.json();

    if (response.ok && token.access_token) return token;

    const errorMessage = String(token.message || token.error || "").toLowerCase();
    if (errorMessage.includes("authorization_pending")) continue;
    if (errorMessage.includes("slow_down")) {
      intervalSeconds += 5;
      continue;
    }
    if (errorMessage.includes("access_denied")) {
      throw new Error("Twitch login was denied.");
    }
    if (errorMessage.includes("expired")) {
      throw new Error("The Twitch login code expired.");
    }

    throw new Error(token.message || "Twitch could not complete device login.");
  }

  throw new Error("The Twitch login code expired.");
}

async function loginWithTwitchDeviceCode() {
  if (loginInProgress) {
    log("Twitch login is already in progress.");
    return;
  }

  loginInProgress = true;
  loginCancelled = false;

  try {
    const deviceAuthorization = await requestDeviceAuthorization();
    const userCode = deviceAuthorization.user_code || "the code shown by Twitch";
    sendLoginProgress(true, `Enter Twitch code: ${userCode}`);
    log(`Twitch login code: ${userCode}`);
    log("Authorize ChatMonJA in the browser. The app will finish login automatically.");
    await shell.openExternal(deviceAuthorization.verification_uri);

    const token = await pollForDeviceToken(deviceAuthorization);
    const twitchUser = await getTwitchUser(token.access_token, TWITCH_CLIENT_ID);

    auth = {
      userId: twitchUser.id || "",
      username: twitchUser.login,
      channelName: twitchUser.login,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || "",
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : null,
      loggedIn: true
    };
    saveAuthFile();
    sendLoginProgress(false, "Twitch login complete.");
    refreshAllLists();
    log(`Logged in with Twitch as ${auth.username}.`);
    await startBot();
  } catch (error) {
    if (!loginCancelled) {
      sendLoginProgress(false, `Login failed: ${error.message}`);
      log(`Login failed: ${error.message}`);
    }
  } finally {
    loginInProgress = false;
  }
}

async function refreshAccessTokenIfNeeded(forceRefresh = false) {
  if (!auth.loggedIn || !auth.accessToken) return false;
  if (!forceRefresh && (!auth.expiresAt || auth.expiresAt > Date.now() + TOKEN_REFRESH_WINDOW_MS)) {
    return true;
  }

  if (!auth.refreshToken || !isClientIdConfigured()) {
    auth = emptyAuth();
    saveAuthFile();
    refreshAllLists();
    log("Your Twitch login expired. Please log in again.");
    return false;
  }

  try {
    const body = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken
    });
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await response.json();

    if (!response.ok || !token.access_token) {
      throw new Error(token.message || "Twitch did not refresh the access token.");
    }

    auth.accessToken = token.access_token;
    auth.refreshToken = token.refresh_token || auth.refreshToken;
    auth.expiresAt = token.expires_in ? Date.now() + token.expires_in * 1000 : null;
    saveAuthFile();
    log("Twitch login refreshed.");
    return true;
  } catch (error) {
    auth = emptyAuth();
    saveAuthFile();
    refreshAllLists();
    log(`Twitch login expired: ${error.message}. Please log in again.`);
    return false;
  }
}

async function ensureValidTwitchSession() {
  if (!(await refreshAccessTokenIfNeeded())) return false;

  try {
    const validation = await validateToken(auth.accessToken, TWITCH_CLIENT_ID);
    const missingScope = REQUIRED_CHAT_SCOPES.find(scope => !validation.scopes?.includes(scope));

    if (missingScope) {
      throw new Error(`Twitch login is missing the ${missingScope} permission.`);
    }

    if (validation.expires_in) {
      auth.expiresAt = Date.now() + validation.expires_in * 1000;
      saveAuthFile();
    }
    return true;
  } catch (error) {
    if (error.status === 401 && auth.refreshToken) {
      if (!(await refreshAccessTokenIfNeeded(true))) return false;

      try {
        const validation = await validateToken(auth.accessToken, TWITCH_CLIENT_ID);
        auth.expiresAt = validation.expires_in
          ? Date.now() + validation.expires_in * 1000
          : auth.expiresAt;
        saveAuthFile();
        return true;
      } catch (refreshValidationError) {
        log(`Twitch login validation failed: ${refreshValidationError.message}`);
      }
    } else {
      log(`Could not validate Twitch login: ${error.message}`);
      return Boolean(auth.expiresAt && auth.expiresAt > Date.now());
    }

    auth = emptyAuth();
    saveAuthFile();
    refreshAllLists();
    return false;
  }
}

function stopTokenValidationTimer() {
  if (tokenValidationTimer) {
    clearInterval(tokenValidationTimer);
    tokenValidationTimer = null;
  }
}

function startTokenValidationTimer() {
  stopTokenValidationTimer();
  tokenValidationTimer = setInterval(async () => {
    if (!auth.loggedIn) return;

    const previousToken = auth.accessToken;
    const valid = await ensureValidTwitchSession();

    if (!valid) {
      if (client) {
        try { await client.disconnect(); } catch (error) { /* already disconnected */ }
        client = null;
      }
      status("Login expired");
      log("Twitch login expired. Log in again to restart the bot.");
      stopTokenValidationTimer();
      return;
    }

    if (client && previousToken !== auth.accessToken) {
      try { await client.disconnect(); } catch (error) { /* reconnect below */ }
      client = null;
      await startBot(true);
    }
  }, TOKEN_VALIDATION_INTERVAL_MS);
}

function handleChatCommand(channel, tags, message, username, userLower, channelName) {
  const parsed = parseCommandMessage(message);
  if (!parsed) return false;

  const command = commands.find(item => item.enabled && item.name === parsed.name);
  if (!command) return true;

  if (!hasCommandPermission(command.allowedRoles || command.permission, tags, userLower, channelName)) {
    const roleLabel = formatAllowedRoleLabel(command.allowedRoles || command.permission);
    log(`Command !${command.name} is restricted to ${roleLabel}.`);
    return true;
  }

  const now = Date.now();
  const globalReadyAt = (commandLastUsed.get(command.id) || 0) + command.cooldownSeconds * 1000;
  const userKey = `${command.id}:${userLower}`;
  const userReadyAt = (commandUserLastUsed.get(userKey) || 0) + command.userCooldownSeconds * 1000;

  if (now < globalReadyAt || now < userReadyAt) return true;

  const response = formatCommandResponse(command.response, {
    username,
    channel: channelName,
    args: parsed.args,
    commands: formatAvailableCommandList(tags, userLower, channelName)
  }).slice(0, 450).trim();

  if (!response) return true;

  commandLastUsed.set(command.id, now);
  commandUserLastUsed.set(userKey, now);
  client.say(channel, response)
    .then(() => log(`Ran !${command.name} for ${username}: ${response}`))
    .catch(error => log(`Could not send !${command.name}: ${error.message}`));
  return true;
}

function formatAllowedRoleLabel(rolesOrPermission) {
  const roles = normalizeCommandRoles(rolesOrPermission);
  if (roles.includes("everyone")) return "everyone";

  const labels = roles.map(role => role === "moderator" ? "moderators" : "the broadcaster");
  return labels.join(" or ");
}

function formatAvailableCommandList(tags = {}, username = "", channelName = "") {
  const names = commands
    .filter(command => command.enabled)
    .filter(command => hasCommandPermission(command.allowedRoles || command.permission, tags, username, channelName))
    .map(command => `!${command.name}`)
    .sort((left, right) => left.localeCompare(right));

  return names.length ? names.join(", ") : "No commands available right now.";
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      currentVersion: app.getVersion(),
      ...payload
    });
  }
}

async function checkForUpdates(manual = false) {
  sendUpdateStatus({
    state: "checking",
    message: "Checking for updates..."
  });

  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": `ChatMonJA/${app.getVersion()}`
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}.`);
    }

    const releases = await response.json();
    const latestRelease = Array.isArray(releases)
      ? releases.find(release => !release.draft)
      : null;

    if (!latestRelease) {
      latestUpdate = null;
      sendUpdateStatus({
        state: "up-to-date",
        message: "No published updates were found."
      });
      return;
    }

    const latestVersion = String(latestRelease.tag_name || latestRelease.name || "")
      .replace(/^v/i, "");
    const asset = selectUpdateAsset(latestRelease.assets, process.platform);
    const isNewer = compareVersions(latestVersion, app.getVersion()) > 0;

    latestUpdate = {
      latestVersion,
      assetName: asset?.name || "",
      downloadUrl: asset?.browser_download_url || latestRelease.html_url,
      releaseUrl: latestRelease.html_url
    };

    if (!isNewer) {
      sendUpdateStatus({
        state: "up-to-date",
        latestVersion,
        releaseUrl: latestRelease.html_url,
        message: `You are on the latest version (${app.getVersion()}).`
      });
      return;
    }

    sendUpdateStatus({
      state: "available",
      latestVersion,
      assetName: latestUpdate.assetName,
      downloadUrl: latestUpdate.downloadUrl,
      releaseUrl: latestUpdate.releaseUrl,
      message: `ChatMonJA ${latestVersion} is available.`
    });
    if (manual) log(`Update available: ChatMonJA ${latestVersion}.`);
  } catch (error) {
    sendUpdateStatus({
      state: "error",
      message: `Could not check for updates: ${error.message}`
    });
    if (manual) log(`Update check failed: ${error.message}`);
  }
}

async function ensureRaidScope() {
  try {
    const validation = await validateToken(auth.accessToken, TWITCH_CLIENT_ID);
    if (validation.scopes?.includes(RAID_SCOPE)) return true;
  } catch (error) {
    if (error.status === 401 && auth.refreshToken) {
      if (await refreshAccessTokenIfNeeded(true)) {
        const validation = await validateToken(auth.accessToken, TWITCH_CLIENT_ID);
        if (validation.scopes?.includes(RAID_SCOPE)) return true;
      }
    } else {
      throw error;
    }
  }

  log("Raid Out needs one extra Twitch permission. Log out, then log in again to enable raids.");
  return false;
}

async function startRaid(targetChannel) {
  const toChannel = normalizeTwitchUsername(targetChannel);

  if (!toChannel) {
    log("Enter a valid Twitch channel name to raid.");
    return;
  }

  if (!auth.loggedIn || !auth.accessToken) {
    log("Log in with Twitch before starting a raid.");
    return;
  }

  const fromChannel = normalizeTwitchUsername(auth.channelName || auth.username);
  if (toChannel === fromChannel) {
    log("Choose another channel to raid.");
    return;
  }

  if (!(await ensureValidTwitchSession())) {
    log("Your Twitch login expired. Log in again before starting a raid.");
    return;
  }

  if (!(await ensureRaidScope())) return;

  try {
    const fromBroadcasterId = await ensureAuthUserId();
    const targetUser = await getTwitchUser(auth.accessToken, TWITCH_CLIENT_ID, toChannel);
    const toBroadcasterId = targetUser.id;

    if (!fromBroadcasterId || !toBroadcasterId) {
      log(`Could not find Twitch channel: ${toChannel}`);
      return;
    }

    const raidUrl = new URL("https://api.twitch.tv/helix/raids");
    raidUrl.searchParams.set("from_broadcaster_id", fromBroadcasterId);
    raidUrl.searchParams.set("to_broadcaster_id", toBroadcasterId);

    const response = await fetch(raidUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${auth.accessToken}`,
        "Client-Id": TWITCH_CLIENT_ID
      }
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || "Twitch could not start the raid.");
    }

    log(`Raid started for ${targetUser.login}. Twitch will show the raid countdown in chat.`);
  } catch (error) {
    log(`Raid failed: ${error.message}`);
  }
}

ipcMain.on("login-twitch", async () => {
  if (!isClientIdConfigured()) {
    log("ChatMonJA's Twitch Client ID has not been configured in main.js.");
    return;
  }

  await loginWithTwitchDeviceCode();
});

ipcMain.on("check-updates", async () => {
  await checkForUpdates(true);
});

ipcMain.on("open-update-download", async () => {
  if (!latestUpdate?.downloadUrl) {
    await checkForUpdates(true);
  }

  if (latestUpdate?.downloadUrl) {
    await shell.openExternal(latestUpdate.downloadUrl);
    log(`Opened update download: ${latestUpdate.assetName || latestUpdate.releaseUrl}`);
  } else {
    log("No update download is available right now.");
  }
});

ipcMain.on("logout-twitch", async () => {
  stopTokenValidationTimer();
  if (loginInProgress) {
    loginCancelled = true;
    sendLoginProgress(false, "Twitch login cancelled.");
    log("Twitch login cancelled.");
  }

  if (client) {
    try {
      await client.disconnect();
    } catch (error) {
      log(`Bot disconnect warning: ${error.message}`);
    }
    client = null;
    status("Disconnected");
  }

  if (auth.accessToken && isClientIdConfigured()) {
    try {
      const revokeUrl = new URL("https://id.twitch.tv/oauth2/revoke");
      revokeUrl.search = new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        token: auth.accessToken
      }).toString();
      await fetch(revokeUrl, { method: "POST" });
    } catch (error) {
      log(`Twitch token revoke warning: ${error.message}`);
    }
  }

  auth = emptyAuth();

  saveAuthFile();
  refreshAllLists();
  log("Logged out of Twitch.");
});

ipcMain.on("save-raid-channel", (_, channel) => {
  const defaultChannel = normalizeTwitchUsername(channel);

  if (!defaultChannel) {
    log("Enter a valid Twitch channel name before saving a raid target.");
    return;
  }

  raidSettings.defaultChannel = defaultChannel;
  saveJsonFile(raidSettingsPath, raidSettings);
  refreshAllLists();
  log(`Default raid channel saved: ${defaultChannel}`);
});

ipcMain.on("clear-raid-channel", () => {
  raidSettings.defaultChannel = "";
  saveJsonFile(raidSettingsPath, raidSettings);
  refreshAllLists();
  log("Default raid channel cleared.");
});

ipcMain.on("start-raid", async (_, channel) => {
  await startRaid(channel || raidSettings.defaultChannel);
});

async function startBot(skipValidation = false) {
  if (client) {
    log("Bot is already running.");
    return;
  }

  if (!skipValidation && !(await ensureValidTwitchSession())) {
    log("Login with Twitch before starting the bot.");
    return;
  }

  const botUsername = auth.username;
  const botToken = auth.accessToken ? `oauth:${auth.accessToken}` : "";
  const channelName = auth.channelName || auth.username;

  if (!auth.loggedIn || !botUsername || !botToken || !channelName) {
    log("Login with Twitch before starting the bot.");
    return;
  }

  log("Starting bot...");

  client = new tmi.Client({
    connection: {
      secure: true,
      reconnect: true
    },
    identity: {
      username: botUsername,
      password: botToken
    },
    channels: [channelName]
  });

  client.on("connected", () => {
    status("Connected");
    log(`Connected to Twitch chat as ${botUsername}.`);
    startTokenValidationTimer();
  });

  client.on("disconnected", (reason) => {
    status("Disconnected");
    log(`Disconnected from Twitch chat. Reason: ${reason}`);
  });

  client.on("message", (channel, tags, message, self) => {
    const today = new Date().getDate();

    if (today !== currentDay) {
      currentDay = today;
      greetedUsers.clear();
      greetingsSent = 0;
      mainWindow.webContents.send("counter", greetingsSent);
      log("Midnight reset completed. Greetings are available again.");
    }

    if (self) return;

    const username = tags["display-name"] || tags.username || "viewer";
    const userLower = username.toLowerCase();
    const selfLower = botUsername.toLowerCase();

    log(`${username}: ${message}`);

    if (!message || message.trim() === "") return;
    if (userLower === selfLower) return;
    if (ignoredBots.includes(userLower)) return;
    if (handleChatCommand(channel, tags, message, username, userLower, channelName)) return;
    if (greetedUsers.has(userLower)) return;

    greetedUsers.add(userLower);

    const dayName = getDayName();
    let finalMessage = "";

    if (specialUsers[userLower]) {
      finalMessage = formatGreeting(specialUsers[userLower], username, dayName);
    } else if (tags.mod) {
      finalMessage = `🛡️ Super Mod ${username}, bless up and welcome this ${dayName}!`;
    } else {
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];

      if (!greeting) {
        log("No greetings found. Add at least one greeting in the Greetings tab.");
        return;
      }

      finalMessage = formatGreeting(greeting, username, dayName);

      if (dayThemes[dayName]) {
        finalMessage += ` Today is ${dayThemes[dayName]}`;
      }
    }

    client.say(channel, finalMessage);

    greetingsSent++;
    mainWindow.webContents.send("counter", greetingsSent);

    log(`Sent greeting to ${username}: ${finalMessage}`);
  });

  try {
    await client.connect();
  } catch (error) {
    status("Connection failed");
    log(`Error: ${error.message}`);
    client = null;
  }
}

ipcMain.on("reset-greetings", () => {
  greetedUsers.clear();
  greetingsSent = 0;
  mainWindow.webContents.send("counter", greetingsSent);
  log("Greetings reset. Users can be greeted again.");
});

ipcMain.on("add-greeting", (_, greeting) => {
  const cleanGreeting = greeting.trim();
  if (!cleanGreeting) return;

  greetings.push(cleanGreeting);
  saveJsonFile(greetingsPath, greetings);
  refreshAllLists();
  log(`New greeting saved: ${cleanGreeting}`);
});

ipcMain.on("edit-greeting", (_, data) => {
  const { index, greeting } = data;
  const cleanGreeting = greeting.trim();

  if (index < 0 || index >= greetings.length) return;
  if (!cleanGreeting) return;

  greetings[index] = cleanGreeting;
  saveJsonFile(greetingsPath, greetings);
  refreshAllLists();
  log(`Greeting ${index + 1} updated.`);
});

ipcMain.on("delete-greeting", (_, index) => {
  if (index < 0 || index >= greetings.length) return;

  const deletedGreeting = greetings[index];
  greetings.splice(index, 1);
  saveJsonFile(greetingsPath, greetings);
  refreshAllLists();
  log(`Deleted greeting: ${deletedGreeting}`);
});

ipcMain.on("add-command", (_, data) => {
  const command = createCommandRecord(data, crypto.randomUUID());

  if (!command) {
    log("Enter a valid command name and a response of 450 characters or fewer.");
    return;
  }
  if (commands.some(item => item.name === command.name)) {
    log(`!${command.name} already exists.`);
    return;
  }

  commands.push(command);
  saveJsonFile(commandsPath, commands);
  refreshAllLists();
  log(`Command added: !${command.name}`);
});

ipcMain.on("edit-command", (_, data) => {
  const index = commands.findIndex(item => item.id === data?.id);
  if (index < 0) return;

  const updated = createCommandRecord({
    ...data,
    enabled: commands[index].enabled
  }, commands[index].id);

  if (!updated) {
    log("Enter a valid command name and a response of 450 characters or fewer.");
    return;
  }
  if (commands.some((item, itemIndex) => itemIndex !== index && item.name === updated.name)) {
    log(`!${updated.name} already exists.`);
    return;
  }

  commands[index] = updated;
  commandLastUsed.delete(updated.id);
  for (const key of commandUserLastUsed.keys()) {
    if (key.startsWith(`${updated.id}:`)) commandUserLastUsed.delete(key);
  }
  saveJsonFile(commandsPath, commands);
  refreshAllLists();
  log(`Command updated: !${updated.name}`);
});

ipcMain.on("toggle-command", (_, id) => {
  const command = commands.find(item => item.id === id);
  if (!command) return;

  command.enabled = !command.enabled;
  saveJsonFile(commandsPath, commands);
  refreshAllLists();
  log(`!${command.name} ${command.enabled ? "enabled" : "disabled"}.`);
});

ipcMain.on("delete-command", (_, id) => {
  const index = commands.findIndex(item => item.id === id);
  if (index < 0) return;

  const [deleted] = commands.splice(index, 1);
  commandLastUsed.delete(deleted.id);
  for (const key of commandUserLastUsed.keys()) {
    if (key.startsWith(`${deleted.id}:`)) commandUserLastUsed.delete(key);
  }
  saveJsonFile(commandsPath, commands);
  refreshAllLists();
  log(`Command deleted: !${deleted.name}`);
});

ipcMain.on("add-special-user", (_, data) => {
  const username = normalizeTwitchUsername(data && data.username);
  const greeting = typeof data?.greeting === "string" ? data.greeting.trim() : "";

  if (!username || !greeting) {
    log("Enter a valid Twitch username and greeting.");
    return;
  }

  specialUsers[username] = greeting;
  saveJsonFile(specialUsersPath, specialUsers);
  refreshAllLists();
  log(`Special user saved: ${username}`);
});

ipcMain.on("edit-special-user", (_, data) => {
  const username = normalizeTwitchUsername(data && data.username);
  const greeting = typeof data?.greeting === "string" ? data.greeting.trim() : "";

  if (!specialUsers[username]) return;
  if (!greeting) return;

  specialUsers[username] = greeting;
  saveJsonFile(specialUsersPath, specialUsers);
  refreshAllLists();
  log(`Special user updated: ${username}`);
});

ipcMain.on("delete-special-user", (_, username) => {
  const userLower = normalizeTwitchUsername(username);

  if (!specialUsers[userLower]) return;

  delete specialUsers[userLower];
  saveJsonFile(specialUsersPath, specialUsers);
  refreshAllLists();
  log(`Special user deleted: ${userLower}`);
});

ipcMain.on("add-day-theme", (_, data) => {
  const day = data.day.trim();
  const theme = data.theme.trim();

  if (!day || !theme) return;

  dayThemes[day] = theme;
  saveJsonFile(dayThemesPath, dayThemes);
  refreshAllLists();
  log(`Day theme saved: ${day}`);
});

ipcMain.on("edit-day-theme", (_, data) => {
  const day = data.day.trim();
  const theme = data.theme.trim();

  if (!dayThemes[day]) return;
  if (!theme) return;

  dayThemes[day] = theme;
  saveJsonFile(dayThemesPath, dayThemes);
  refreshAllLists();
  log(`Day theme updated: ${day}`);
});

ipcMain.on("delete-day-theme", (_, day) => {
  if (!dayThemes[day]) return;

  delete dayThemes[day];
  saveJsonFile(dayThemesPath, dayThemes);
  refreshAllLists();
  log(`Day theme deleted: ${day}`);
});

ipcMain.on("add-ignored-bot", (_, username) => {
  const user = normalizeTwitchUsername(username);

  if (!user) return;
  if (ignoredBots.includes(user)) {
    log(`${user} is already in ignored bots.`);
    return;
  }

  ignoredBots.push(user);
  saveJsonFile(ignoredBotsPath, ignoredBots);
  refreshAllLists();
  log(`Ignored bot added: ${user}`);
});

ipcMain.on("delete-ignored-bot", (_, username) => {
  const user = normalizeTwitchUsername(username);

  if (!ignoredBots.includes(user)) {
    log(`${user} was not found in ignored bots.`);
    return;
  }

  ignoredBots = ignoredBots.filter(bot => bot !== user);
  saveJsonFile(ignoredBotsPath, ignoredBots);
  refreshAllLists();
  log(`Ignored bot removed: ${user}`);
});

ipcMain.on("create-backup", () => {
  ensureFolder(backupsPath);

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");

  const backup = {
    createdAt: now.toISOString(),
    version: "1.3",
    greetings,
    commands,
    specialUsers,
    dayThemes,
    ignoredBots
  };

  const fileName = `backup-${timestamp}.json`;
  const backupPath = path.join(backupsPath, fileName);

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  refreshAllLists();
  log(`Backup created: ${fileName}`);
});

ipcMain.on("restore-backup", (_, fileName) => {
  ensureFolder(backupsPath);

  if (typeof fileName !== "string" || !getBackupFiles().includes(fileName)) {
    log("That backup file is not available.");
    return;
  }

  const backupPath = path.join(backupsPath, fileName);

  if (!fs.existsSync(backupPath)) {
    log(`Backup not found: ${fileName}`);
    return;
  }

  try {
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));

    greetings = backup.greetings || [];
    commands = (Array.isArray(backup.commands) ? backup.commands : [])
      .map(command => createCommandRecord(command, command.id || crypto.randomUUID()))
      .filter(Boolean);
    specialUsers = backup.specialUsers || {};
    dayThemes = backup.dayThemes || {};
    ignoredBots = backup.ignoredBots || [];

    saveJsonFile(greetingsPath, greetings);
    saveJsonFile(commandsPath, commands);
    saveJsonFile(specialUsersPath, specialUsers);
    saveJsonFile(dayThemesPath, dayThemes);
    saveJsonFile(ignoredBotsPath, ignoredBots);

    refreshAllLists();
    log(`Backup restored: ${fileName}`);
  } catch (error) {
    log(`Restore failed: ${error.message}`);
  }
});

ipcMain.on("refresh-backups", () => {
  mainWindow.webContents.send("backup-list", getBackupFiles());
});

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(APP_ICON_PATH);
  }
  initializeStorage();
  createWindow();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  loginCancelled = true;
  stopTokenValidationTimer();
});

const { contextBridge, ipcRenderer } = require("electron");

const sendChannels = new Set([
  "reset-greetings",
  "login-twitch",
  "logout-twitch",
  "check-updates",
  "open-update-download",
  "save-raid-channel",
  "clear-raid-channel",
  "start-raid",
  "add-greeting",
  "edit-greeting",
  "delete-greeting",
  "add-command",
  "edit-command",
  "delete-command",
  "toggle-command",
  "add-special-user",
  "edit-special-user",
  "delete-special-user",
  "add-day-theme",
  "delete-day-theme",
  "add-ignored-bot",
  "delete-ignored-bot",
  "create-backup",
  "refresh-backups",
  "restore-backup"
]);

const receiveChannels = new Set([
  "log",
  "status",
  "counter",
  "auth-status",
  "login-progress",
  "update-status",
  "greetings-list",
  "commands-list",
  "special-users-list",
  "day-themes-list",
  "ignored-bots-list",
  "raid-settings",
  "backup-list"
]);

contextBridge.exposeInMainWorld("chatmonja", {
  send(channel, payload) {
    if (sendChannels.has(channel)) ipcRenderer.send(channel, payload);
  },
  on(channel, listener) {
    if (!receiveChannels.has(channel)) return;
    ipcRenderer.on(channel, (_event, ...args) => listener(null, ...args));
  }
});

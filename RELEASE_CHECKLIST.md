# ChatMonJA Release Checklist

## Automated checks

- [ ] `npm run check` passes
- [ ] `npm audit --omit=dev` reports no known production vulnerabilities
- [ ] `npm run package:mac` succeeds
- [ ] `hdiutil verify <DMG>` succeeds
- [ ] `codesign --verify --deep --strict --verbose=2 <ChatMonJA.app>` succeeds

## Clean-install test

- [ ] Test on a Mac that has never run ChatMonJA, or launch with a temporary user-data directory
- [ ] Drag ChatMonJA into Applications from the DMG
- [ ] Confirm the correct icon, app name, and version appear
- [ ] Confirm only one app instance opens
- [ ] Confirm Login with Twitch opens the activation page and shows the matching code
- [ ] Quit and reopen; confirm the saved login reconnects automatically
- [ ] Confirm Logout disconnects and removes the saved login
- [ ] Confirm a backup survives app restart and restores greetings and commands correctly

Example isolated launch for development:

```sh
open -na "./out/ChatMonJA-darwin-arm64/ChatMonJA.app" \
  --args --user-data-dir="/tmp/chatmonja-clean-test"
```

## Real-stream test

- [ ] Use a test stream or low-traffic channel
- [ ] Send a normal message from a second Twitch account; confirm one greeting
- [ ] Send another message from the same account; confirm no duplicate greeting
- [ ] Test a special user and a moderator greeting
- [ ] Test an ignored bot account
- [ ] Add an everyone command; confirm `!command` sends its configured response
- [ ] Confirm command placeholders, enable/disable, global cooldown, and viewer cooldown work
- [ ] Confirm moderator-only and broadcaster-only commands reject unauthorized viewers
- [ ] Confirm an unknown `!command` does not trigger a greeting
- [ ] Confirm day-theme text appears on the configured day
- [ ] Leave the app open through a reconnect or network interruption
- [ ] Review the Activity Log for token, chat, or connection errors

## Public macOS release

- [ ] Developer ID Application certificate is installed
- [ ] DMG is Developer ID signed
- [ ] Apple notarization succeeds
- [ ] Notarization ticket is stapled and validated
- [ ] Gatekeeper test passes on a separate Mac with default security settings
- [ ] Git tag matches the app version
- [ ] GitHub Release includes DMG, checksums, release notes, privacy notice, and known limitations

## Windows 11 tester

- [ ] GitHub Actions **Build Windows tester** workflow passes
- [ ] ZIP extracts without warnings from the archive utility
- [ ] `ChatMonJA.exe` shows the correct name, icon, and version
- [ ] Test on a clean Windows 11 x64 account
- [ ] Complete Twitch login, restart, logout, backup, and real-stream checks
- [ ] Confirm no `.env`, authentication, local data, or backups are packaged
- [ ] Acquire Windows code signing before public distribution

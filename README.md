# ChatMonJA

ChatMonJA is a friendly Twitch welcome and community bot for macOS and Windows 11. It automatically connects after Twitch login, welcomes each viewer once per session, and supports custom greetings, chat commands, special users, day themes, ignored bots, backups, and local activity logging.

Created by **Elmore 'JimmyQ' Jamieson** — **@jimmyqja**.

## Features

- Login through Twitch Device Code authentication—no password or token entry
- Automatic chat connection and reconnection
- Rotating greetings with `${username}` and `${dayName}` placeholders
- Custom `!commands` with permissions, enable/disable controls, anti-spam cooldowns, and a default `!list` command
- Command-response placeholders for `{username}`, `{channel}`, and `{args}`
- Special-user greetings and day themes
- Ignored-bot list
- Local backup and restore
- Encrypted token storage through Electron `safeStorage` when available
- Hourly Twitch token validation with proactive refresh

## Development

Requires Node.js and macOS for the current packaging scripts.

```sh
npm install
npm start
```

Run the automated checks:

```sh
npm run check
```

## Local data

ChatMonJA stores settings and backups under Electron's per-user application-data directory, not inside the installed application. Existing development data is migrated automatically on first launch.

Authentication tokens are never included in backups. See [PRIVACY.md](PRIVACY.md) for details.

## Build a macOS DMG

Build an arm64 DMG using the Electron runtime installed on the current Mac:

```sh
npm run package:mac
```

Without an Apple identity, this creates an ad-hoc-signed DMG for local testing. It is not suitable for public distribution.

### Developer ID signing

Join the Apple Developer Program, install a **Developer ID Application** certificate, and confirm it is visible:

```sh
security find-identity -v -p codesigning
```

Then build with its exact identity:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
npm run package:mac
```

### Notarization

Store notarization credentials in the macOS Keychain:

```sh
xcrun notarytool store-credentials "chatmonja-notary" \
  --apple-id "you@example.com" \
  --team-id "TEAMID" \
  --password "APP-SPECIFIC-PASSWORD"
```

Then notarize and staple the signed DMG:

```sh
export APPLE_NOTARY_PROFILE="chatmonja-notary"
npm run notarize:mac -- out/ChatMonJA-1.3.3-mac-arm64-signed.dmg
```

The notarization script uses Apple's current `notarytool` workflow and validates the stapled ticket.

## Build for Windows 11

The Windows tester is an unsigned x64 ZIP. Build it on Windows 11:

```powershell
npm install
npm run check
npm run package:win
```

GitHub Actions also includes a **Build Windows tester** workflow. Run it manually from the Actions tab, then download the generated artifact. Windows SmartScreen may warn about the unsigned tester build; public distribution requires a Windows code-signing certificate.

## Release testing

Follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before publishing a GitHub Release.

## Website

The static download website lives in [docs](docs). It is ready for GitHub Pages and points to the latest GitHub Release download assets for macOS and Windows 11.

## Roadmap

- Migrate chat transport from Twitch IRC/tmi.js to EventSub WebSocket plus Send Chat Message API
- Signed universal macOS build
- Opt-in automatic updates after signed releases are available
- Privacy-preserving crash reporting after a collection endpoint and consent UI exist

## License

ChatMonJA is available under the [ISC License](LICENSE).

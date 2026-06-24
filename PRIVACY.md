# ChatMonJA Privacy Notice

**Effective date:** June 22, 2026

ChatMonJA is designed to keep its data on your computer.

## Data ChatMonJA stores locally

- Twitch username and channel name
- Twitch access and refresh tokens
- Greeting templates, custom commands, special users, day themes, and ignored bots
- Backups created by the user

Twitch tokens are encrypted using the operating system protection exposed by Electron `safeStorage` when that protection is available. Authentication tokens are not included in ChatMonJA backups.

## Twitch data

When ChatMonJA is running, it receives Twitch chat messages needed to identify viewers and send configured greetings or command responses. The Activity Log is held in the running app and is not uploaded by ChatMonJA.

Twitch authentication and chat traffic are sent directly to Twitch and are governed by Twitch's own privacy policy and terms.

## Analytics and crash reporting

ChatMonJA does not currently include analytics, advertising, telemetry, or remote crash reporting.

## Data deletion

Logging out revokes the current Twitch access token and removes the locally saved login. Uninstalling ChatMonJA does not automatically remove its per-user application-data folder or backups; those may be deleted manually.

## Contact

Privacy questions may be submitted by email to support@chatmonja.com or through the ChatMonJA GitHub repository:
https://github.com/jimmyqja/ChatMonJA

Creator: Elmore 'JimmyQ' Jamieson — @jimmyqja

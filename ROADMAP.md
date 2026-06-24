# ChatMonJA Technical Roadmap

## 1. EventSub chat migration

The v1.3 release continues to use tmi.js and Twitch IRC because it is stable for the existing single-channel greeting and command workflow. Twitch now recommends EventSub for receiving chat and the Send Chat Message API for sending messages.

Planned migration:

1. Add `user:read:chat` and `user:write:chat` to the Device Code scopes.
2. Retain the Twitch user ID returned during login.
3. Open an EventSub WebSocket session.
4. Create a `channel.chat.message` subscription for the authenticated channel.
5. Translate EventSub badges into the existing moderator, greeting, and command-permission rules.
6. Send greetings and command responses through `POST /helix/chat/messages`.
7. Keep the tmi.js implementation behind a temporary compatibility flag until real-stream parity tests pass.
8. Remove tmi.js and the legacy `chat:read`/`chat:edit` scopes.

This is intentionally a post-v1.3 migration because it changes authentication scopes, message payloads, reconnect behavior, and the core transport simultaneously.

## 2. Automatic updates

Do not enable automatic updates until releases are consistently signed and notarized. The updater must verify signed artifacts and use a stable publishing channel.

Recommended sequence:

1. Publish two manually signed/notarized releases successfully.
2. Decide whether GitHub Releases will remain the permanent update host.
3. Add an opt-in update setting and visible release notes.
4. Test upgrade, downgrade prevention, interrupted download, and rollback behavior.

## 3. Crash reporting

Remote crash reporting remains disabled in v1.3. Adding it requires:

- a documented collection endpoint and retention period;
- user consent before upload;
- removal of Twitch tokens, usernames, chat messages, and local paths from reports;
- updates to `PRIVACY.md`;
- a way for users to disable reporting and delete submitted data.

Until those pieces exist, local Activity Log diagnostics are the safer default.

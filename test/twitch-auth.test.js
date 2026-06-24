const test = require("node:test");
const assert = require("node:assert/strict");
const { validateToken } = require("../lib/twitch-auth");

function response(ok, status, body) {
  return { ok, status, json: async () => body };
}

test("validateToken returns Twitch validation metadata", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://id.twitch.tv/oauth2/validate");
    assert.equal(options.headers.Authorization, "OAuth token-123");
    return response(true, 200, {
      client_id: "client-123",
      login: "jimmyqja",
      expires_in: 3600,
      scopes: ["chat:read", "chat:edit"]
    });
  };

  const result = await validateToken("token-123", "client-123", fetchImpl);
  assert.equal(result.login, "jimmyqja");
  assert.equal(result.expires_in, 3600);
});

test("validateToken rejects invalid tokens", async () => {
  const fetchImpl = async () => response(false, 401, { message: "invalid access token" });
  await assert.rejects(
    validateToken("expired", "client-123", fetchImpl),
    error => error.status === 401 && /invalid access token/.test(error.message)
  );
});

test("validateToken rejects tokens issued to another app", async () => {
  const fetchImpl = async () => response(true, 200, {
    client_id: "different-client",
    expires_in: 3600
  });
  await assert.rejects(
    validateToken("token-123", "client-123", fetchImpl),
    /different application/
  );
});

async function validateToken(accessToken, expectedClientId, fetchImpl = fetch) {
  if (!accessToken) throw new Error("Missing Twitch access token.");

  const response = await fetchImpl("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` }
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Twitch access token is invalid.");
    error.status = response.status;
    throw error;
  }

  if (data.client_id !== expectedClientId) {
    throw new Error("Twitch token belongs to a different application.");
  }

  return data;
}

module.exports = { validateToken };

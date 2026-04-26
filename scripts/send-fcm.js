import { readFile } from "node:fs/promises";

import { FCM_SCOPE, FCM_TOKEN_URL, PATHS } from "./lib/constants.js";
import { readJsonFile, signJwt } from "./lib/utils.js";

function getCredentialsPath() {
  const value = process.env.FIREBASE_CREDENTIALS_PATH;
  if (!value) {
    throw new Error("FIREBASE_CREDENTIALS_PATH is required.");
  }
  return value;
}

async function fetchAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: FCM_TOKEN_URL,
      exp: now + 3600,
      iat: now
    },
    serviceAccount.private_key
  );

  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch(FCM_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google OAuth token: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Google OAuth token response did not include access_token.");
  }

  return data.access_token;
}

async function sendTopicMessage(accessToken, projectId, message) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        message: {
          topic: message.topic,
          notification: {
            title: message.title,
            body: message.body
          },
          data: message.data
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to send FCM message: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function main() {
  const payloads = await readJsonFile(PATHS.fcmPayloadsData);
  if (!payloads) {
    throw new Error("Missing data/fcm-payloads.json. Run npm run build:json first.");
  }

  if (!Array.isArray(payloads.messages) || payloads.messages.length === 0) {
    console.log("No FCM messages to send.");
    return;
  }

  const credentialsPath = getCredentialsPath();
  const serviceAccount = JSON.parse(await readFile(credentialsPath, "utf8"));
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Invalid Firebase service account JSON.");
  }

  const accessToken = await fetchAccessToken(serviceAccount);
  for (const message of payloads.messages) {
    const response = await sendTopicMessage(accessToken, serviceAccount.project_id, message);
    console.log(`Sent FCM message to topic=${message.topic} name=${response.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

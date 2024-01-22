require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");

const TOKEN_PATH = path.join(process.cwd(), "token.json");
// const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

// Function to log the data object to the console
function logCompleteJsonObject (jsonObject) {
  console.log(JSON.stringify(jsonObject, null, 4));
}

// Load the credentials from the token.json file
async function loadSavedCredentialsIfExist () {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

// Call the API to get message
async function getMessage (auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages
    .get({
      userId: "me",
      id: messageId
    })
    .catch((err) => console.log(err.message));
  return res ? reduceMessage(res.data) : null;
}

function base64ToString (stringEncoded) {
  // eslint-disable-next-line new-cap
  const buff = new Buffer.from(stringEncoded, "base64");
  return buff.toString("ascii");
}

function reduceMessage (message) {
  if (!message.payload.parts) return null;

  const headers = {};
  message.payload.headers.forEach((header) => {
    if (header.name.match(/^(From|Date|To|Subject|Date)$/g)) {
      headers[`${header.name.toLowerCase()}`] = header.value;
    }
  });

  const part = message.payload.parts.find((p) => {
    return p.mimeType === "text/plain";
  });
  const content = part ? base64ToString(part.body.data) : "";

  return {
    id: message.id,
    ...headers,
    labels: message.labelIds,
    snippet: message.snippet,
    body: content
  };
}

// Get history details based on history ID
async function getHistory (auth, historyId) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.history.list({
    userId: "me",
    startHistoryId: historyId
  });
  // The main part of the response comes
  // in the "data" attribute.
  return res.data;
}

// Connect to Pub Sub
async function watch (auth) {
  const gmail = google.gmail({ version: "v1", auth });
  return await gmail.users.watch({
    userId: "me",
    requestBody: {
      labelIds: ["INBOX"],
      topicName: process.env.TOPIC_NAME
    }
  }).catch(err => console.log(err.message));
}

async function sendTelegramMessage (message) {
  const bot = new TelegramBot(process.env.BOT_TOKEN);
  return await bot.sendMessage(process.env.CHAT_ID, message).catch((err) => {
    return err.message;
  });
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials (client) {
  // const content = await fs.readFile(CREDENTIALS_PATH);
  const content = process.env.CREDENTIALS_JSON;
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.access_token
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */

module.exports = {
  logCompleteJsonObject,
  loadSavedCredentialsIfExist,
  getMessage,
  getHistory,
  base64ToString,
  watch,
  sendTelegramMessage,
  saveCredentials
};

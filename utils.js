require("dotenv").config();
const process = require("process");
const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");
const { Client } = require("pg");

const clientConfig = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD
};

// Function to log the data object to the console
function logCompleteJsonObject (jsonObject) {
  console.log(JSON.stringify(jsonObject, null, 4));
}

// Load the credentials from the token.json file
async function loadSavedCredentialsIfExist () {
  try {
    const accessToken = await getConfigData("access_token");
    const keys = getCredenialsKeys();
    const credentials = {
      type: "authorized_user",
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      refresh_token: accessToken
    };
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
  return await gmail.users
    .watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX"],
        topicName: process.env.TOPIC_NAME
      }
    })
    .catch((err) => {
      return { error: true, message: err.message };
    });
}

async function sendTelegramMessage (message) {
  const bot = new TelegramBot(process.env.BOT_TOKEN);
  return await bot.sendMessage(process.env.CHAT_ID, message).catch((err) => {
    return err.message;
  });
}

async function saveConfigData (configName, configValue, table = "config") {
  const client = new Client(clientConfig);
  await client.connect();
  try {
    let sql = `SELECT * FROM ${table} WHERE name = '${configName}'`;
    const { rows } = await client.query(sql);
    const values = [configName, configValue];
    if (rows[0]) {
      sql = `UPDATE ${table} SET value = $2 WHERE name = $1 RETURNING *`;
    } else {
      sql = `INSERT INTO ${table}(name, value) VALUES($1, $2) RETURNING *`;
    }
    await client.query(sql, values);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function getConfigData (configName, table = "config") {
  const client = new Client(clientConfig);
  await client.connect();
  try {
    const sql = `SELECT value FROM ${table} WHERE name = '${configName}'`;
    const { rows } = await client.query(sql);
    return rows[0] ? rows[0].value : null;
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

function getCredenialsKeys () {
  const content = process.env.CREDENTIALS_JSON;
  const keys = JSON.parse(content);
  return keys.installed || keys.web;
}

module.exports = {
  logCompleteJsonObject,
  loadSavedCredentialsIfExist,
  getMessage,
  getHistory,
  base64ToString,
  watch,
  sendTelegramMessage,
  saveConfigData,
  getConfigData
};

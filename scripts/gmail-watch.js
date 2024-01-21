require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(process.cwd(), "token.json");

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

// Connect to Pub Sub
async function connectPubSub (auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      labelIds: ["INBOX"],
      topicName: process.env.TOPIC_NAME
    }
  });
  console.log(res);
}

// Run the script
(async () => {
  const cred = await loadSavedCredentialsIfExist();
  await connectPubSub(cred);
})();

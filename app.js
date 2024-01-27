const {
  loadSavedCredentialsIfExist,
  getHistory,
  base64ToString,
  getMessage,
  watch,
  sendTelegramMessage,
  saveConfigData
} = require("./utils");
const { OAuth2Client } = require("google-auth-library");
const express = require("express");
const app = express();
const port = process.env.PORT || 5555;

let previousHistoryId = 0;

const keys = JSON.parse(process.env.CREDENTIALS_JSON);
const oAuth2Client = new OAuth2Client(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[0]
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  const fullUrl = `https://${req.get("host")}/auth`;
  res.json({ authUrl: fullUrl });
});

app.get("/history/:hid", async (req, res) => {
  const error = { error: false };
  const cred = await loadSavedCredentialsIfExist();
  const historyId = req.params.hid;
  const history = await getHistory(cred, historyId).catch((err) => {
    error.error = true;
    error.message = err.message;
    console.log(err.message);
  });
  if (error.error) {
    res.json(error);
  } else {
    res.json({ reqHistoryId: req.params.hid, history });
  }
});

app.get("/watch", async (req, res) => {
  const cred = await loadSavedCredentialsIfExist();
  const result = await watch(cred);
  res.json(result);
});

app.get("/auth", async (req, res) => {
  if (req.query.code) {
    const code = req.query.code;
    const error = { error: true };

    const r = await oAuth2Client.getToken(code).catch((err) => {
      console.log(err.message);
      error.message = err.message;
    });

    if (r) {
      oAuth2Client.setCredentials(r.tokens);
      await saveConfigData("access_token", oAuth2Client.credentials.access_token).catch((err) =>
        console.log(err.message)
      );
      res.redirect("/watch");
      return;
    }
    res.json(error);
  } else {
    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/gmail.readonly"
    });

    res.redirect(authorizeUrl);
  }
});

app.post("/notify", async (req, res) => {
  const cred = await loadSavedCredentialsIfExist();
  if (req.body.message) {
    const historyObj = await getHistory(cred, previousHistoryId).catch((err) =>
      console.log(err.message)
    );
    const messages = [];
    if (historyObj && historyObj.history) {
      let currentMessageId = "";
      for (const historyItem of historyObj.history) {
        const messageId = historyItem.messages[0].id;
        const message = await getMessage(cred, messageId);
        if (message && currentMessageId !== messageId) {
          messages.push(message);
          currentMessageId = messageId;
          sendTelegramMessage(
            `${message.subject}\n${message.snippet}\n\n${message.from}\n${message.date}\n`
          );
        }
      }
    }
    const notifBodyStr = base64ToString(req.body.message.data);
    const notifBody = JSON.parse(notifBodyStr);
    console.log("prev:", previousHistoryId, "curr:", notifBody.historyId);
    previousHistoryId = notifBody.historyId;
    console.log(messages);
    res.json(messages);
  } else {
    res.json({ error: true, message: "Historique introuvable" });
  }
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

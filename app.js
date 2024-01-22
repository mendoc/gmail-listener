const {
  loadSavedCredentialsIfExist,
  getHistory,
  base64ToString,
  getMessage,
  watch,
  sendTelegramMessage,
  authorize
} = require("./utils");
const express = require("express");
const app = express();
const port = process.env.PORT || 5555;

let previousHistoryId = 0;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  const result = watch(cred);
  res.json(result);
});

app.get("/auth", async (req, res) => {
  const result = await authorize();
  res.json(result);
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

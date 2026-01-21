const fetch = require("node-fetch");

exports.sendPush = async (token, title, body, data = {}) => {
  if (!token) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body,
        data
      })
    });

    const result = await response.json();

    // Expo balikin error walau HTTP 200
    if (result.data?.status === "error") {
      console.error("Expo push error:", result.data.message);
    }

  } catch (err) {
    console.error("Push send failed:", err.message);
  }
};

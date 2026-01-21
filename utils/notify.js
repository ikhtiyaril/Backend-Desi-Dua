const { Notification, PushToken } = require("../models");
const { sendPush } = require("./push");

async function notifyUser({ user_id, doctor_id, title, body, type, booking_id }) {
  await Notification.create({
    user_id,
    doctor_id,
    title,
    body,
    type,
    booking_id
  });

  const token = await PushToken.findOne({
    where: user_id ? { user_id } : { doctor_id }
  });

  if (token) {
    await sendPush(token.expo_token, title, body, {
      type,
      booking_id
    });
  }
}

module.exports = { notifyUser };

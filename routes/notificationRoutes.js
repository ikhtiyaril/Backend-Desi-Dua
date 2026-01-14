const express = require("express");
const router = express.Router();
const { Notification, PushToken, Booking, User, Doctor } = require("../models");
const verifyToken  = require("../middleware/verifyToken");
const { sendPush } = require("../utils/push");

/* ===============================
   REGISTER PUSH TOKEN
================================ */
router.post("/register-token", verifyToken, async (req, res) => {
  try {
    const { expo_token } = req.body;

    if (!expo_token) {
      return res.status(400).json({ message: "Expo token required" });
    }

    await PushToken.upsert({
      user_id: req.user.role === "patient" ? req.user.id : null,
      doctor_id: req.user.role === "doctor" ? req.user.id : null,
      expo_token
    });

    res.json({ message: "Push token registered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   GET MY NOTIFICATIONS
================================ */
router.get("/", verifyToken, async (req, res) => {
  try {
    const where =
      req.user.role === "patient"
        ? { user_id: req.user.id }
        : { doctor_id: req.user.id };

    const data = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [{ model: Booking }]
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   MARK AS READ
================================ */
router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findByPk(req.params.id);

    if (!notif) return res.status(404).json({ message: "Not found" });

    notif.is_read = true;
    await notif.save();

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   SEND MANUAL NOTIFICATION
   (Admin / System use)
================================ */
router.post("/send", async (req, res) => {
  try {
    const { user_id, doctor_id, title, body, type, booking_id } = req.body;

    const token = await PushToken.findOne({
      where: user_id ? { user_id } : { doctor_id }
    });

    await Notification.create({
      user_id,
      doctor_id,
      booking_id,
      title,
      body,
      type
    });

    if (token) {
      await sendPush(token.expo_token, title, body);
    }

    res.json({ message: "Notification sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

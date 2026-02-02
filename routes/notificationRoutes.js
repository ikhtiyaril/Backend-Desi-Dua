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
    console.log("[REGISTER TOKEN] Request body:", req.body);
    console.log("[REGISTER TOKEN] User from token:", req.user);

    if (!expo_token) {
      console.log("[REGISTER TOKEN] Missing expo_token");
      return res.status(400).json({ message: "Expo token required" });
    }

    const upsertResult = await PushToken.upsert({
      user_id: req.user.role === "patient" ? req.user.id : null,
      doctor_id: req.user.role === "doctor" ? req.user.id : null,
      expo_token
    });

    console.log("[REGISTER TOKEN] Upsert result:", upsertResult);

    res.json({ message: "Push token registered" });
  } catch (err) {
    console.error("[REGISTER TOKEN] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   GET MY NOTIFICATIONS
================================ */
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log("[GET NOTIFICATIONS] User:", req.user);
    const where =
      req.user.role === "patient"
        ? { user_id: req.user.id }
        : { doctor_id: req.user.id };

    const data = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [{ model: Booking }]
    });

    console.log("[GET NOTIFICATIONS] Found:", data.length);
    res.json(data);
  } catch (err) {
    console.error("[GET NOTIFICATIONS] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   MARK AS READ
================================ */
router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    console.log("[MARK AS READ] Notification ID:", req.params.id);
    const notif = await Notification.findByPk(req.params.id);

    if (!notif) {
      console.log("[MARK AS READ] Not found");
      return res.status(404).json({ message: "Not found" });
    }

    notif.is_read = true;
    await notif.save();

    console.log("[MARK AS READ] Notification marked as read:", notif.id);
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("[MARK AS READ] Error:", err);
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
    console.log("[SEND NOTIF] Request body:", req.body);

    const token = await PushToken.findOne({
      where: user_id ? { user_id } : { doctor_id }
    });
    console.log("[SEND NOTIF] Found push token:", token?.expo_token);

    const notif = await Notification.create({
      user_id,
      doctor_id,
      booking_id,
      title,
      body,
      type
    });
    console.log("[SEND NOTIF] Created notification:", notif.id);

    if (token) {
      const pushResult = await sendPush(token.expo_token, title, body);
      console.log("[SEND NOTIF] Push result:", pushResult);
    }

    res.json({ message: "Notification sent" });
  } catch (err) {
    console.error("[SEND NOTIF] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

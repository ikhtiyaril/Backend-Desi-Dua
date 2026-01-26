const express = require('express')
const axios = require('axios')
const crypto =require('crypto')
const verifyToken = require("../middleware/verifyToken");
const {PaymentSession,Order,Booking} = require("../models")
const router = express.Router();
const { Sequelize } = require("sequelize");


function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}


router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      /* ================= DEBUG AWAL ================= */
      console.log("➡️ CALLBACK HIT");
      console.log("Content-Type:", req.headers["content-type"]);
      console.log("Signature Header:", req.headers["x-callback-signature"]);
      console.log("RawBody Exist:", !!req.body);
      console.log("RawBody Length:", req.body?.length);
      /* =============================================== */

      if (!req.body) {
        console.error("❌ RAW BODY TIDAK TERBACA");
        return res.status(400).json({ success: false });
      }

      const rawBody = req.body.toString("utf8");
      const signature = req.headers["x-callback-signature"];

      const expected = crypto
        .createHmac("sha256", process.env.PRIVATE_KEY_TRIPAY)
        .update(rawBody)
        .digest("hex");

      console.log("Expected Signature:", expected);
      console.log("Incoming Signature:", signature);

      if (signature !== expected) {
        console.error("❌ SIGNATURE TIDAK VALID");
        return res.status(403).json({ success: false });
      }

      // ✅ BARU PARSE SETELAH SIGNATURE VALID
      const payload = JSON.parse(rawBody);

      console.log("Parsed Body:", payload);

      const tripayReference = payload.reference;
      const tripayStatus = payload.status;

      console.log("Tripay Reference:", tripayReference);
      console.log("Tripay Status:", tripayStatus);

      const session = await PaymentSession.findOne({
  where: Sequelize.where(
    Sequelize.json("session_data.data.reference"),
    tripayReference
  ),
});

      if (!session) {
        console.warn("⚠️ PAYMENT SESSION TIDAK DITEMUKAN");
        return res.status(200).json({ success: true });
      }

      if (session.status === "PAID") {
        console.log("ℹ️ SESSION SUDAH PAID (IDEMPOTENT)");
        return res.status(200).json({ success: true });
      }

      await session.update({ status: tripayStatus });
      console.log("✅ PAYMENT SESSION UPDATED");

      if (tripayStatus === "PAID") {
        if (session.related_type === "order") {
          await Order.update(
            {
              payment_status: "PAID",
              status: "processing",
              payment_method: payload.payment_method,
            },
            { where: { id: session.related_id } }
          );
          console.log("✅ ORDER UPDATED");
        }

        if (session.related_type === "booking") {
          await Booking.update(
            {
              payment_status: "paid",
              status: "confirmed",
              payment_method: payload.payment_method,
            },
            { where: { id: session.related_id } }
          );
          console.log("✅ BOOKING UPDATED");
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("🔥 CALLBACK ERROR:", err);
      return res.status(200).json({ success: true });
    }
  }
);

module.exports = router;

const express = require('express')
const { AccessToken } = require('livekit-server-sdk')
const router = express.Router()
const { Booking } = require('../models')
const verifyToken = require('../middleware/verifyToken')

router.get('/:booking_id', verifyToken, async (req, res) => {
  try {
    console.log("===== LIVEKIT TOKEN DEBUG START =====");

    console.log("🔹 User From Token:", req.user);

    const { booking_id } = req.params;
    const { id, name } = req.user;

    console.log("🔹 Booking ID Param:", booking_id);

    // Database check
    const book = await Booking.findOne({ where: { id: booking_id } });
    console.log("🔹 Booking DB Result:", book);

    if (!book) {
      console.log("❌ Booking not found");
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (book.patient_id !== id || book.doctor_id !== id) {
      console.log("❌ Patient not authorized:", { patient_id: book.patient_id, user_id: id });
      return res.status(403).json({ error: 'Not authorized' });
    }

    const participantName = `${name}${Math.floor(Math.random() * 900 + 100)}`;
    const roomName = book.booking_code;

    console.log("🔹 Participant Name:", participantName);
    console.log("🔹 Room Name:", roomName);

    // Check environment variables
    console.log("🔹 LiveKit API KEY Exists:", !!process.env.LIVEKIT_API_KEY);
    console.log("🔹 LiveKit API SECRET Exists:", !!process.env.LIVEKIT_API_SECRET);

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      console.log("❌ Missing LiveKit API Key or Secret");
      return res.status(500).json({ error: "LiveKit environment variables missing" });
    }

    // Generate token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        ttl: 600,
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
    });

    console.log("🔹 Grant Added:", { roomJoin: true, room: roomName });

    const token = await at.toJwt();
    console.log("🔹 JWT Generated OK");

    console.log("===== LIVEKIT TOKEN DEBUG END =====");
console.log(token)
    res.json({ token, participantName, roomName });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    res.status(500).json({ error: 'Server error', debug: err.message });
  }
});

module.exports = router;

const express = require('express')
const { AccessToken } = require('livekit-server-sdk')
const router = express.Router()
const { Booking } = require('../models')
const verifyToken = require('../middleware/verifyToken')

router.get('/:booking_id', verifyToken, async (req, res) => {
  try {
    const { booking_id } = req.params
    const { id, name } = req.user

    const book = await Booking.findOne({ where: { id : booking_id } })
    if (!book) return res.status(403).json({ error: 'Booking not found' })
    if (book.patient_id !== id) return res.status(403).json({ error: 'Not authorized' })

    const participantName = name + Math.floor(Math.random() * 900 + 100)
    const roomName = book.booking_code

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: 600, // 10 menit
    })
    at.addGrant({ roomJoin: true, room: roomName })
    const token = at.toJwt()

    res.json({ token, participantName, roomName })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

const express = require('express');
const router = express.Router();
const { Booking, Service, Doctor, User , BlockedTime } = require('../models'); // pastikan path sesuai
const { Op } = require('sequelize');
const verifyToken = require("../middleware/verifyToken");

router.post('/', verifyToken, async (req, res) => {
  try {
    const { service_id, doctor_id, date, time_start, notes } = req.body;
    const { id } = req.user;

    const patient_id = id;

    const serv = await Service.findOne({ where: { id: service_id } });
    if (!serv) {
      return res.status(404).json({ message: "Service tidak ditemukan" });
    }

    function addMinutes(timeStr, minutesToAdd) {
      const [h, m] = timeStr.split(":").map(Number);
      const total = h * 60 + m + minutesToAdd;
      const newH = Math.floor(total / 60) % 24;
      const newM = total % 60;
      return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
    }

    const time_end = addMinutes(time_start, serv.duration_minutes);

    if (!patient_id || !service_id || !date || !time_start || !time_end) {
      return res.status(400).json({ message: 'Data incomplete.' });
    }

    const booking_code = `BKG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create booking
    const booking = await Booking.create({
      booking_code,
      patient_id,
      service_id,
      doctor_id: doctor_id || null,
      date,
      time_start,
      time_end,
      notes: notes || ""
    });

    // ----- AUTO GENERATE BLOCKED TIME -----
    if (doctor_id) {
      await BlockedTime.create({
        doctor_id,
        service_id,
        date,
        time_start,
        time_end,
        booking_id: booking.id   // kalau kolom ini ada
      });
    }

    return res.status(201).json({
      message: "Booking created & blocked time added",
      booking
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat booking', error: err.message });
  }
});


// ========================
// Get all Bookings (user optional filter)
// ========================
router.get('/', async (req, res) => {
  try {
    const { patient_id, status } = req.query;
    let where = {};

    if (patient_id) where.patient_id = patient_id;
    if (status) where.status = status;

    const bookings = await Booking.findAll({
      where,
      include: [
        { model: Service },
        { model: Doctor },
        { model: User, attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'ASC'], ['time_start', 'ASC']]
    });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil booking', error: err.message });
  }
});

// ========================
// Get Booking by ID
// ========================
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Service },
        { model: Doctor },
        { model: User, attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil booking', error: err.message });
  }
});

// ========================
// Update Booking (misal status, notes, payment_method)
// ========================
router.put('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    const { status, notes, payment_method, doctor_id, date, time_start, time_end } = req.body;

    await booking.update({
      status: status || booking.status,
      notes: notes !== undefined ? notes : booking.notes,
      payment_method: payment_method || booking.payment_method,
      doctor_id: doctor_id !== undefined ? doctor_id : booking.doctor_id,
      date: date || booking.date,
      time_start: time_start || booking.time_start,
      time_end: time_end || booking.time_end
    });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal update booking', error: err.message });
  }
});

// ========================
// Delete Booking
// ========================
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    await booking.destroy();
    res.json({ message: 'Booking berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal hapus booking', error: err.message });
  }
});

// Ubah status booking
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "confirmed", "cancelled", "completed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    }

    booking.status = status;
    await booking.save();

    return res.json({ message: "Status updated", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal update status", error: err.message });
  }
});


module.exports = router;

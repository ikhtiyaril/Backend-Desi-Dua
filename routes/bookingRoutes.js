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
  booked_by: booking.id   // ← ini wajib
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

// routes/bookingRoutes.js

router.get("/me", verifyToken, async (req, res) => {


  try {
    const userId = req.user.id;

    const bookings = await Booking.findAll({
      where: { patient_id: userId },
      include: [
        {
          model: Service,
          attributes: ["id", "name", "duration_minutes", "price","is_live"],
        },
        {
          model: Doctor,
          attributes: ["id", "name"],
        }
        
      ],
      order: [["id", "DESC"]],
    });

    

    return res.json({
      success: true,
      data: bookings,
    });

  } catch (err) {
    console.log("----- ERROR WHILE GETTING BOOKINGS -----");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil booking user",
      error: err.message,
    });
  }
});


router.get("/doctor", verifyToken, async (req, res) => {
  console.log("===== /doctor route hit =====");

  try {
    console.log("REQ USER:", req.user); // lihat isi user dari token

    const userId = req.user?.id;
    if (!userId) {
      console.log("⚠️ User ID tidak ditemukan di token!");
      return res.status(400).json({ success: false, message: "User ID tidak ditemukan" });
    }

    const bookings = await Booking.findAll({
      where: { doctor_id: userId },
      include: [
        {
          model: Service,
          attributes: ["id", "name", "duration_minutes", "price", "is_live"],
        },
        {
          model: Doctor,
          attributes: ["id", "name"],
        }
      ],
      order: [["id", "DESC"]],
    });

    console.log(`✅ Bookings fetched: ${bookings.length} items`);
    // optional: log the first booking to see structure
    if (bookings.length > 0) console.log("First booking:", bookings[0].toJSON());

    return res.json({
      success: true,
      data: bookings,
    });

  } catch (err) {
    console.log("----- ERROR WHILE GETTING BOOKINGS -----");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil booking doctor",
      error: err.message,
      stack: err.stack, // ini ngebantu debug error lebih detail
    });
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

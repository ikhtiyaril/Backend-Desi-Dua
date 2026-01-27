// routes/blockedTimeRoutes.js
const express = require("express");
const router = express.Router();
const { BlockedTime, Doctor, Service, Booking } = require("../models");
const authMiddleware = require("../middleware/auth"); // middleware cek token
const { Op } = require("sequelize");


router.get("/", authMiddleware, async (req, res) => {
  try {
    const blockedTimes = await BlockedTime.findAll({
      include: [
        { model: Doctor, attributes: ["id", "name"] },
        { model: Booking, attributes: ["id", "booking_code"] },
      ],
      order: [["date", "ASC"], ["time_start", "ASC"]],
    });

    res.json(blockedTimes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal ambil blocked times", error: err.message });
  }
});

router.get("/my", authMiddleware, async (req, res) => {
  try {
    const doctorId = req.user.id;

    const blockedTimes = await BlockedTime.findAll({
      where: { doctor_id: doctorId },
      include: [
        { model: Doctor, attributes: ["id", "name"] },
        { model: Booking, attributes: ["id", "booking_code"] },

      ],
      order: [["date", "ASC"], ["time_start", "ASC"]],
    });

    res.json(blockedTimes);
  } catch (err) {
    console.error("❌ ERROR GET MY BLOCKED TIMES:", err);
    res.status(500).json({
      message: "Gagal ambil blocked time dokter",
      error: err.message,
    });
  }
});


router.get("/doctor/:doctorId/date/:date", async (req, res) => {
  try {
    console.log("=== [GET BLOCKED TIMES] ===");
    console.log("Raw Params:", req.params);

    const { doctorId, date } = req.params;

    console.log("Parsed Params:");
    console.log("  doctorId:", doctorId, typeof doctorId);
    console.log("  date:", date, typeof date);

    // Check format date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn("⚠️ WARNING: date format tidak valid (YYYY-MM-DD)");
    }

    // Query
    console.log("\nQuerying database...");
    const blockedTimes = await BlockedTime.findAll({
      where: { doctor_id: doctorId, date },
      order: [["time_start", "ASC"]],
    });

    console.log("\nDB Result Count:", blockedTimes.length);
    console.log("DB Result Raw:", JSON.stringify(blockedTimes, null, 2));

    // Jika ada data, tampilkan elemen pertama buat ngecek structure
    if (blockedTimes.length > 0) {
      console.log("\nFirst Item Structure Keys:", Object.keys(blockedTimes[0].dataValues));
      console.log("First Item:", blockedTimes[0].dataValues);
    } else {
      console.log("\nTidak ada blockedTime untuk dokter & tanggal ini.");
    }

    console.log("\n=== END DEBUG ===\n");

    res.json(blockedTimes);

  } catch (err) {
    console.error("❌ ERROR in /blocked-time/doctor/:doctorId/date/:date");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    res.status(500).json({
      message: "Gagal ambil blocked times",
      error: err.message,
    });
  }
});



router.post("/", authMiddleware, async (req, res) => {
  console.log("\n=== DEBUG CREATE BLOCKED TIME REQUEST ===");

  try {
    const { doctor_id, date, time_start, time_end } = req.body;

    // ================= VALIDATION =================
    if (!doctor_id || !date || !time_start || !time_end) {
      return res.status(400).json({
        success: false,
        message: "Field wajib diisi"
      });
    }

    if (time_start >= time_end) {
      return res.status(400).json({
        success: false,
        message: "Jam mulai harus lebih kecil dari jam selesai"
      });
    }

    // ================= CHECK OVERLAP =================
    const conflict = await BlockedTime.findOne({
      where: {
        doctor_id,
        date,
        [Op.and]: [
          { time_start: { [Op.lt]: time_end } },
          { time_end: { [Op.gt]: time_start } }
        ]
      }
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "Blocked time bentrok dengan jadwal lain",
        conflict
      });
    }

    // ================= CREATE =================
    const blockedTime = await BlockedTime.create({
      doctor_id,
      date,
      time_start,
      time_end
    });

    return res.status(201).json({
      success: true,
      message: "Blocked time berhasil dibuat",
      blockedTime
    });

  } catch (err) {
    console.error("❌ ERROR CREATE BLOCKED TIME:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal buat blocked time",
      error: err.message
    });
  }
});


router.post("/doctor", authMiddleware, async (req, res) => {
  console.log("\n=== DEBUG CREATE BLOCKED TIME REQUEST ===");

  try {
    console.log("Raw Body:", req.body);
const { id } = req.user
    const {  date, time_start, time_end, } = req.body;

    console.log("Parsed Fields:");
    console.log("doctor_id:", id);
    console.log("date:", date);
    console.log("time_start:", time_start);
    console.log("time_end:", time_end);

    // Validasi
    if (!date || !time_start || !time_end ) {
      console.log("❌ Validation failed: missing field");
      return res.status(400).json({ message: "Field wajib diisi" });
    }

    console.log("Creating BlockedTime...");

    const blockedTime = await BlockedTime.create({
      doctor_id : id,
      date,
      time_start,
      time_end,
      booked_by: null, 
    });

    console.log("✅ BlockedTime berhasil dibuat:");
    console.dir(blockedTime.toJSON(), { depth: null });

    res.status(201).json({
      message: "Blocked time dibuat",
      blockedTime,
    });

  } catch (err) {
    console.log("\n❌ ERROR IN CREATE BLOCKED TIME ===");
    console.log("Message:", err.message);
    console.log("Stack:", err.stack);

    res.status(500).json({
      message: "Gagal buat blocked time",
      error: err.message,
    });
  }
});


router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await BlockedTime.update(req.body, { where: { id } });

    if (!updated[0]) return res.status(404).json({ message: "Blocked time tidak ditemukan" });

    res.json({ message: "Blocked time berhasil diupdate" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal update blocked time", error: err.message });
  }
});


router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BlockedTime.destroy({ where: { id } });

    if (!deleted) return res.status(404).json({ message: "Blocked time tidak ditemukan" });

    res.json({ message: "Blocked time berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal hapus blocked time", error: err.message });
  }
});

module.exports = router;

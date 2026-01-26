const express = require('express');
const router = express.Router();

const { Doctor, DoctorSchedule } = require('../models');
const verifyToken = require('../middleware/verifyToken')

// CREATE schedule
router.post('/', async (req, res) => {
  try {
    const { doctor_id, day_of_week, start_time, end_time } = req.body;

    if (!doctor_id || day_of_week === undefined) {
      return res.status(400).json({ error: "doctor_id & day_of_week are required" });
    }

    const doctor = await Doctor.findByPk(doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // 🔒 VALIDASI: Cek apakah hari tsb sudah ada
    const existingSchedule = await DoctorSchedule.findOne({
      where: {
        doctor_id,
        day_of_week
      }
    });

    if (existingSchedule) {
      return res.status(409).json({
        error: "Schedule for this day already exists"
      });
    }

    const data = await DoctorSchedule.create({
      doctor_id,
      day_of_week,
      start_time,
      end_time
    });

    res.status(201).json({ message: "Schedule created", data });

  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

router.put('/bulk-update', verifyToken, async (req, res) => {
  const { days, start_time, end_time } = req.body;
  const { id: doctor_id } = req.user;

  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: "days must be a non-empty array" });
  }

  if (!start_time || !end_time) {
    return res.status(400).json({ error: "start_time and end_time are required" });
  }

  try {
    const updated = [];

    for (const day of days) {
      const [schedule, created] = await DoctorSchedule.findOrCreate({
        where: {
          doctor_id,
          day_of_week: day
        },
        defaults: {
          start_time,
          end_time
        }
      });

      if (!created) {
        await schedule.update({
          start_time,
          end_time
        });
      }

      updated.push(schedule);
    }

    res.json({
      message: "Schedules updated successfully",
      total: updated.length
    });

  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({ error: "Failed to bulk update schedules" });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      doctor_id,
      day_of_week,
      start_time,
      end_time,
      break_start,
      break_end,
    } = req.body;

    console.log("[UPDATE SCHEDULE]", id, req.body);

    if (!doctor_id || day_of_week === "" || !start_time || !end_time) {
      return res.status(400).json({
        message: "doctor_id, day_of_week, start_time, end_time wajib diisi",
      });
    }

    const schedule = await DoctorSchedule.findByPk(id);
    if (!schedule) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    await schedule.update({
      doctor_id,
      day_of_week,
      start_time,
      end_time,
      break_start: break_start || null,
      break_end: break_end || null,
    });

    return res.json({
      success: true,
      message: "Jadwal berhasil diperbarui",
      data: schedule,
    });

  } catch (err) {
    console.error("[UPDATE SCHEDULE ERROR]", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET all schedules
router.get('/', async (req, res) => {
  console.log("GET / - Fetching all doctor schedules...");

  try {
    const data = await DoctorSchedule.findAll({
      include: ['Doctor']
    });

    console.log("Fetched schedules:", data.length);
    res.json(data);

  } catch (error) {
    console.error("[ERROR] GET / -", error.message);
    res.status(500).json({ error: "Failed to fetch schedules", details: error.message });
  }
});


// GET schedules by doctor ID (simple)
router.get('/me', verifyToken,async (req, res) => {
  console.log('pegang ini')
const {id} = req.user
  console.log(`GET /doctor/${id} - Fetching schedules...`);

  try {
    const data = await DoctorSchedule.findAll({
      where: { doctor_id: id }
    });

    res.json(data);

  } catch (error) {
    console.error(`[ERROR] GET /doctor/${id} -`, error.message);
    res.status(500).json({ error: "Failed to fetch doctor schedules", details: error.message });
  }
});


// GET schedules by doctor ID + date (route baru)
router.get('/:doctorId', async (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;

  console.log(`GET /doctor/${doctorId}/doctor-schedule?date=${date}`);

  try {
    if (!date) {
      return res.status(400).json({ error: "date query param is required" });
    }

    const data = await DoctorSchedule.findAll({
      where: {
        doctor_id: doctorId,
        day_of_week: new Date(date).getDay()
      }
    });

    res.json(data);

  } catch (error) {
    console.error(`[ERROR] GET doctor schedule by date -`, error.message);
    res.status(500).json({ error: "Failed to fetch doctor schedule for date", details: error.message });
  }
});


// DELETE schedule
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await DoctorSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    await schedule.destroy();
    res.json({ message: "Schedule deleted" });

  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});


module.exports = router;

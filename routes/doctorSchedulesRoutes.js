const express = require('express');
const router = express.Router();

const { Doctor, DoctorSchedule } = require('../models');


// CREATE schedule
router.post('/', async (req, res) => {
  try {
    const { doctor_id } = req.body;

    if (!doctor_id) {
      return res.status(400).json({ error: "doctor_id is required" });
    }

    const doctor = await Doctor.findByPk(doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const data = await DoctorSchedule.create(req.body);
    res.status(201).json({ message: "Schedule created", data });

  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: "Failed to create schedule" });
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
router.get('/doctor/:doctorId', async (req, res) => {
  const { doctorId } = req.params;

  console.log(`GET /doctor/${doctorId} - Fetching schedules...`);

  try {
    const data = await DoctorSchedule.findAll({
      where: { doctor_id: doctorId }
    });

    res.json(data);

  } catch (error) {
    console.error(`[ERROR] GET /doctor/${doctorId} -`, error.message);
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

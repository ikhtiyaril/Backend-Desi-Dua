const express = require('express');
const router = express.Router();
const { Booking, Service, Doctor, BlockedTime } = require("../models");
const verifyToken = require("../middleware/verifyToken");

// =========================
// CREATE SERVICE
// =========================
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      duration_minutes, 
      price, 
      require_doctor, 
      allow_walkin,
      is_live, 
      doctorIds 
    } = req.body;

    const service = await Service.create({
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live
    });

    if (doctorIds && Array.isArray(doctorIds)) {
      await service.setDoctors(doctorIds);
    }

    const result = await Service.findOne({
      where: { id: service.id },
      include: Doctor
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("ERROR CREATE SERVICE:", err);
    res.status(500).json({ 
      message: 'Gagal membuat service', 
      error: err.message 
    });
  }
});

// =========================
// GET ALL SERVICES
// =========================
router.get('/', async (req, res) => {
  const debug = req.query.debug === '1';

  try {
    const services = await Service.findAll({
      include: { model: Doctor, through: { attributes: [] } },
      order: [['id', 'ASC']]
    });

    const raw = services.map(s => s.toJSON());

    // Format output biar VUE/REACT gampang pakai
    const formatted = raw.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      require_doctor: s.require_doctor,
      allow_walkin: s.allow_walkin,
      is_live: s.is_live,
      doctorIds: Array.isArray(s.Doctors)
        ? s.Doctors.map(d => d.id)
        : []
    }));

    if (debug) return res.json(raw);
    return res.json(formatted);

  } catch (err) {
    console.error("ERROR GET SERVICES:", err);
    res.status(500).json({ 
      message: 'Gagal mengambil services', 
      error: err.message 
    });
  }
});

// =========================
// GET SERVICE BY ID
// =========================
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findOne({
      where: { id: req.params.id },
      include: Doctor
    });

    if (!service)
      return res.status(404).json({ message: "Service tidak ditemukan" });

    res.json(service);
  } catch (err) {
    console.error("ERROR GET SERVICE:", err);
    res.status(500).json({ message: "Gagal mengambil service" });
  }
});

// =========================
// UPDATE SERVICE
// =========================
router.put('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service)
      return res.status(404).json({ message: "Service tidak ditemukan" });

    const { 
      name, 
      description, 
      duration_minutes, 
      price, 
      require_doctor, 
      allow_walkin,
      is_live,
      doctorIds 
    } = req.body;

    await service.update({
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live
    });

    if (doctorIds && Array.isArray(doctorIds)) {
      await service.setDoctors(doctorIds);
    }

    const updated = await Service.findOne({
      where: { id: service.id },
      include: Doctor
    });

    res.json(updated);
  } catch (err) {
    console.error("ERROR UPDATE SERVICE:", err);
    res.status(500).json({ message: "Gagal update service", error: err.message });
  }
});

// =========================
// DELETE SERVICE
// =========================
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service)
      return res.status(404).json({ message: "Service tidak ditemukan" });

    await service.setDoctors([]); // hapus relasi pivot
    await service.destroy();

    res.json({ message: "Service berhasil dihapus" });
  } catch (err) {
    console.error("ERROR DELETE SERVICE:", err);
    res.status(500).json({ message: "Gagal hapus service" });
  }
});



module.exports = router;

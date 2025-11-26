const express = require('express');
const router = express.Router();
const { Service, Doctor } = require('../models');


router.post('/', async (req, res) => {
  try {
    const { name, description, duration_minutes, price, require_doctor, allow_walkin, doctorIds } = req.body;

    // 1. Buat service dulu
    const service = await Service.create({
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin
    });

    // 2. Attach dokter jika ada
    if (doctorIds && Array.isArray(doctorIds) && doctorIds.length > 0) {
      await service.setDoctors(doctorIds);
    }

    // 3. Load service beserta doctors
    const serviceWithDoctors = await Service.findOne({
      where: { id: service.id },
      include: Doctor
    });

    res.status(201).json(serviceWithDoctors);
  } catch (err) {
    console.error("ERROR CREATE SERVICE:", err);
    res.status(500).json({ message: 'Gagal membuat service', error: err.message });
  }
});

router.get('/', async (req, res) => {
  const debug = req.query.debug === '1' || req.query.debug === 'true';

  try {
    const services = await Service.findAll({
      include: { model: Doctor, through: { attributes: [] } },
      order: [['id', 'ASC']],
    });

    // Raw to plain object (untuk logging / debug)
    const raw = services.map(s => {
      try {
        return s.toJSON();
      } catch (e) {
        // fallback jika bukan instance sequelize
        return s;
      }
    });

    
   

    // Safely map Doctors -> doctorIds
    const formatted = raw.map(s => {
      const doctorArray = Array.isArray(s.Doctors) ? s.Doctors : [];
      if (!Array.isArray(s.Doctors)) {
        console.warn(`[Service GET] service id=${s.id} has no "Doctors" array (will use empty doctorIds).`);
      }
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        duration_minutes: s.duration_minutes,
        price: s.price,
        require_doctor: s.require_doctor,
        allow_walkin: s.allow_walkin,
        // ensure all ids are numbers (or whatever shape you prefer)
        doctorIds: doctorArray.map(d => (d && d.id ? d.id : null)).filter(Boolean),
      };
    });



    return res.json(formatted);
  } catch (err) {
    console.error("ERROR GET SERVICES:", err);
    // lebih detail di response saat mode development (opsional)
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      message: 'Gagal mengambil services',
      error: isDev ? err.message : 'internal server error',
      stack: isDev ? err.stack : undefined,
    });
  }
});



router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findOne({
      where: { id: req.params.id },
      include: Doctor
    });
    if (!service) return res.status(404).json({ message: 'Service tidak ditemukan' });

    res.json(service);
  } catch (err) {
    console.error("ERROR GET SERVICE:", err);
    res.status(500).json({ message: 'Gagal mengambil service', error: err.message });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service tidak ditemukan' });

    const { name, description, duration_minutes, price, require_doctor, allow_walkin, doctorIds } = req.body;

    // Update data service
    await service.update({ name, description, duration_minutes, price, require_doctor, allow_walkin });

    // Update pivot table dokter
    if (doctorIds && Array.isArray(doctorIds)) {
      await service.setDoctors(doctorIds);
    }

    // Load ulang service beserta doctors
    const updatedService = await Service.findOne({
      where: { id: service.id },
      include: Doctor
    });

    res.json(updatedService);
  } catch (err) {
    console.error("ERROR UPDATE SERVICE:", err);
    res.status(500).json({ message: 'Gagal update service', error: err.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service tidak ditemukan' });

    // Hapus semua relasi dokter di pivot table
    await service.setDoctors([]);
    await service.destroy();

    res.json({ message: 'Service berhasil dihapus' });
  } catch (err) {
    console.error("ERROR DELETE SERVICE:", err);
    res.status(500).json({ message: 'Gagal hapus service', error: err.message });
  }
});

module.exports = router;

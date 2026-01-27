const express = require('express');
const router = express.Router();

const {
  Booking,
  Service,
  Doctor,
  BlockedTime,
  Post
} = require("../models");

const verifyToken = require("../middleware/verifyToken");
const upload = require("../middleware/cbUploads");
const BASE_URL = process.env.BACKEND_URL;
// helper: build image url
const buildImageUrl = (req, file) => {
  if (!file) return null;
  return `${BASE_URL}/uploads/${file.filename}`;
};

const requireDoctor = (req, res, next) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ message: "Doctor only access" });
  }
  next();
};

// helper to parse boolean-like values from req.body (handles "true"/"false" strings)
const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return undefined;
};

//
// =========================
// CREATE SERVICE (ADMIN)
// =========================
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live,
      doctorIds,
      article_id,
      active: activeRaw
    } = req.body;

    const image_url = buildImageUrl(req, req.file);

    // parse active if provided
    const activeVal = parseBoolean(activeRaw);

    // Build payload so we DON'T overwrite model default if active not provided
    const createPayload = {
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live,
      article_id: article_id || null,
      image_url
    };

    if (typeof activeVal !== "undefined") {
      createPayload.active = activeVal;
    }

    const service = await Service.create(createPayload);

    if (doctorIds) {
      const parsed = Array.isArray(doctorIds)
        ? doctorIds
        : JSON.parse(doctorIds);
      await service.setDoctors(parsed);
    }

    const result = await Service.findByPk(service.id, {
      include: [
        { model: Doctor, through: { attributes: [] } },
        { model: Post, as: 'article' }
      ]
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

//
// =========================
// GET ALL SERVICES
// =========================
router.get('/', async (req, res) => {
  try {
    const services = await Service.findAll({
      include: [
        { model: Doctor, through: { attributes: [] } },
        { model: Post, as: 'article' }
      ],
      order: [['id', 'ASC']]
    });

    const formatted = services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      require_doctor: s.require_doctor,
      allow_walkin: s.allow_walkin,
      is_live: s.is_live,
      image_url: s.image_url,

      // ✅ tambahkan active di response
      active: s.active,

      // ✅ INI YANG HILANG
      is_doctor_service: s.is_doctor_service,
      exclusive_doctor_id: s.exclusive_doctor_id,

      article: s.article ? {
        id: s.article.id,
        title: s.article.title,
        slug: s.article.slug
      } : null,

      doctorIds: s.Doctors?.map(d => d.id) || []
    }));

    res.json(formatted);
  } catch (err) {
    console.error("ERROR GET SERVICES:", err);
    res.status(500).json({
      message: 'Gagal mengambil services',
      error: err.message
    });
  }
});

//
// =========================
// GET SERVICE BY ID
// =========================
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id, {
      include: [
        { model: Doctor, through: { attributes: [] } },
        { model: Post, as: 'article' }
      ]
    });

    if (!service) {
      return res.status(404).json({ message: "Service tidak ditemukan" });
    }

    res.json(service);
  } catch (err) {
    console.error("ERROR GET SERVICE:", err);
    res.status(500).json({ message: "Gagal mengambil service" });
  }
});

//
// =========================
// UPDATE SERVICE (ADMIN)
// =========================
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service tidak ditemukan" });
    }

    const {
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live,
      doctorIds,
      article_id,
      active: activeRaw
    } = req.body;

    const image_url = req.file
      ? buildImageUrl(req, req.file)
      : service.image_url;

    const activeVal = parseBoolean(activeRaw);

    const updatePayload = {
      name,
      description,
      duration_minutes,
      price,
      require_doctor,
      allow_walkin,
      is_live,
      article_id: article_id || null,
      image_url
    };

    // Only set active when provided in request
    if (typeof activeVal !== "undefined") {
      updatePayload.active = activeVal;
    }

    await service.update(updatePayload);

    if (doctorIds) {
      const parsed = Array.isArray(doctorIds)
        ? doctorIds
        : JSON.parse(doctorIds);
      await service.setDoctors(parsed);
    }

    const updated = await Service.findByPk(service.id, {
      include: [
        { model: Doctor, through: { attributes: [] } },
        { model: Post, as: 'article' }
      ]
    });

    res.json(updated);
  } catch (err) {
    console.error("ERROR UPDATE SERVICE:", err);
    res.status(500).json({
      message: "Gagal update service",
      error: err.message
    });
  }
});

//
// =========================
// DELETE SERVICE
// =========================
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service tidak ditemukan" });
    }

    await service.setDoctors([]);
    await service.destroy();

    res.json({ message: "Service berhasil dihapus" });
  } catch (err) {
    console.error("ERROR DELETE SERVICE:", err);
    res.status(500).json({ message: "Gagal hapus service" });
  }
});

//
// =========================
// GET SERVICES BY DOCTOR
// =========================
router.get('/doctors/:doctorId/services', async (req, res) => {
  const { doctorId } = req.params;

  const services = await Service.findAll({
    include: {
      model: Doctor,
      where: { id: doctorId },
      through: { attributes: [] }
    }
  });

  res.json(services);
});

//
// =========================
// EXCLUSIVE DOCTOR SERVICES
// =========================
router.get('/doctors/exclusive-services', async (req, res) => {
  try {
    const services = await Service.findAll({
      where: { is_doctor_service: true },
      order: [['id', 'ASC']]
    });

    res.json(services);
  } catch (err) {
    res.status(500).json({
      message: 'Gagal mengambil service eksklusif dokter',
      error: err.message
    });
  }
});

router.get(
  "/doctor/services/exclusive",
  verifyToken,
  requireDoctor,
  async (req, res) => {
    try {
      const doctorId = req.user.id;

      const services = await Service.findAll({
        where: {
          is_doctor_service: true,
          exclusive_doctor_id: doctorId,
        },
        order: [["id", "ASC"]],
      });

      res.json({
        success: true,
        data: services,
      });
    } catch (err) {
      res.status(500).json({
        message: "Gagal mengambil service eksklusif dokter",
        error: err.message,
      });
    }
  }
);

router.put(
  "/doctor/services/:id",
  verifyToken,
  requireDoctor,
  async (req, res) => {
    try {
      const doctorId = req.user.id;
      const serviceId = req.params.id;

      const {
        name,
        description,
        duration_minutes,
        price,
        allow_walkin,
        is_live,
        image_url,
        active: activeRaw
      } = req.body;

      // 1️⃣ Cari service
      const service = await Service.findByPk(serviceId);

      if (!service) {
        return res.status(404).json({
          message: "Service tidak ditemukan",
        });
      }

      // 2️⃣ Pastikan ini service eksklusif
      if (!service.is_doctor_service) {
        return res.status(403).json({
          message: "Service ini bukan service eksklusif dokter",
        });
      }

      // 3️⃣ Pastikan service milik dokter ini
      if (service.exclusive_doctor_id !== doctorId) {
        return res.status(403).json({
          message: "Anda tidak berhak mengedit service ini",
        });
      }

      // 4️⃣ Update field yang diizinkan
      const activeVal = parseBoolean(activeRaw);
      const payload = {
        name,
        description,
        duration_minutes,
        price,
        allow_walkin,
        is_live,
        image_url
      };

      if (typeof activeVal !== "undefined") {
        payload.active = activeVal;
      }

      await service.update(payload);

      res.json({
        success: true,
        message: "Service eksklusif berhasil diperbarui",
        data: service,
      });
    } catch (err) {
      res.status(500).json({
        message: "Gagal mengupdate service",
        error: err.message,
      });
    }
  }
);

// =========================
// UPDATE SERVICE BY DOCTOR
// =========================
router.put('/doctor/services/:id', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const serviceId = req.params.id;

    const service = await Service.findOne({
      where: { id: serviceId },
      include: {
        model: Doctor,
        where: { id: doctorId },
        through: { attributes: [] }
      }
    });

    if (!service) {
      return res.status(403).json({
        message: 'Tidak punya akses ke service ini'
      });
    }

    const allowedFields = [
      'description',
      'price',
      'duration_minutes',
      'is_live',
      'active' // tambahkan active agar dokter bisa non-aktifkan jika perlu
    ];

    const payload = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        // special handling for booleans that may be strings
        if (key === 'active') {
          const parsed = parseBoolean(req.body[key]);
          if (typeof parsed !== 'undefined') payload[key] = parsed;
        } else {
          payload[key] = req.body[key];
        }
      }
    }

    await service.update(payload);

    res.json({ message: 'Service berhasil diupdate', service });
  } catch (err) {
    res.status(500).json({ message: 'Gagal update service' });
  }
});

module.exports = router;

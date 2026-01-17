const express = require('express');
const bcrypt = require('bcryptjs');
const { Doctor, Booking,DoctorSchedule ,Service,BlockedTime, sequelize } = require('../models');
const sendEmail = require('../utils/sendmail');
const jwt = require('jsonwebtoken');
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");
const upload = require("../middleware/cbUploads");

const router = express.Router();

// ================= CRUD DOCTOR =================
router.post('/login', async (req, res) => {
  try {
    console.log("==== Login Request ====");
    console.log("Body:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Email atau password kosong");
      return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    // Cek email
    const doctor = await Doctor.findOne({ where: { email } });
    console.log("Doctor found:", doctor);

    if (!doctor) {
      console.log("Email tidak ditemukan di database");
      return res.status(400).json({ message: 'Email tidak ditemukan' });
    }

    // Cek password
    const isMatch = await bcrypt.compare(password, doctor.password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      console.log("Password salah");
      return res.status(400).json({ message: 'Password salah' });
    }

    // (Optional) cek status aktif
    // if (!doctor.isActive) {
    //   console.log("Akun belum aktif");
    //   return res.status(403).json({ message: 'Akun Anda belum diaktifkan admin' });
    // }

    // Buat token
    const token = jwt.sign(
      {
        id: doctor.id,
        email: doctor.email,
        name: doctor.name,
        avatar: doctor.avatar,
        role: "doctor"
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log("Token generated:", token);

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        avatar: doctor.avatar,
      }
    });

  } catch (err) {
    console.error("ERROR CAUGHT IN LOGIN ROUTE:", err);
    res.status(500).json({ message: 'Gagal login', error: err.message });
  }
});

// Create doctor
router.post('/', upload.single('avatar'), async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    let { name, email, phone, specialization, bio, avatar, Study } = req.body;

    if (req.file) {
      avatar = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;
    }

    const exist = await Doctor.findOne({ where: { email } });
    if (exist) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    const password = '1234asdf';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // =========================
    // 1️⃣ Create Doctor
    // =========================
    const doctor = await Doctor.create({
      name,
      email,
      phone,
      password: hash,
      specialization,
      bio,
      avatar,
      Study,
      isActive: false
    }, { transaction });

    // =========================
    // 2️⃣ Default Schedule
    // =========================
    const defaultSchedules = [1, 2, 3, 4, 5].map(day => ({
      doctor_id: doctor.id,
      day_of_week: day,
      start_time: '08:00:00',
      end_time: '16:00:00'
    }));

    await DoctorSchedule.bulkCreate(defaultSchedules, { transaction });

    // =========================
    // 3️⃣ Auto-create Doctor Service
    // =========================
    const doctorService = await Service.create({
      name: `Konsultasi ${doctor.name}`,
      description: `Konsultasi langsung dengan ${doctor.name}${specialization ? ` (${specialization})` : ''}`,
      duration_minutes: 30,
      price: 0, // bisa diupdate dokter nanti
      require_doctor: true,
      allow_walkin: false,
      is_live: false,
      is_doctor_service: true,
      exclusive_doctor_id: doctor.id
    }, { transaction });

    // =========================
    // 4️⃣ Attach Service ↔ Doctor
    // =========================
    await doctorService.addDoctor(doctor.id, { transaction });

    // =========================
    // 5️⃣ Commit
    // =========================
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Doctor created with default schedule and exclusive service',
      data: {
        doctor,
        service: doctorService
      }
    });

  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({
      message: 'Gagal membuat dokter',
      error: err.message
    });
  }
});

// Read all doctors
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.findAll();
    res.json({ success: true, data: doctors });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data dokter', error: err.message });
  }
});

// Read one doctor by id
router.get("/me", verifyToken, async (req, res) => {
  console.log("=== HIT /me ===");

  try {
    console.log("req.user:", req.user);

    if (!req.user || !req.user.id) {
      console.log("❌ req.user kosong atau id tidak ada");
      return res.status(401).json({
        message: "Unauthorized - user tidak valid",
      });
    }

    const id = req.user.id;
    console.log("Doctor ID:", id);

    const doctor = await Doctor.findByPk(id, {
      include: [{ model: Booking }],
    });

    console.log("Doctor result:", doctor);

    if (!doctor) {
      console.log("❌ Doctor tidak ditemukan");
      return res.status(404).json({
        message: "Dokter tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: doctor,
    });

  } catch (err) {
    console.error("🔥 /me ERROR FULL:", err);

    res.status(500).json({
      message: "Gagal mengambil dokter",
      error: err.message,
    });
  }
});


router.put('/status', verifyToken, async (req, res) => {
  try {
    console.log('kenatipis /status')
    const { isActive } = req.body;
    const { id } = req.user;

    const doctor = await Doctor.findByPk(id);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.update({ isActive });

    res.json({
      success: true,
      isActive: doctor.isActive,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Update status failed' });
  }
});
// Update doctor
router.put("/:id", upload.single("avatar"), async (req, res) => {
  try {
    console.log("=== DEBUG MULTER ===");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    const { name, phone, specialization, bio, Study, isActive } = req.body;

    // Ambil doctor
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Dokter tidak ditemukan" });
    }

    // Tentukan URL avatar baru (kalau ada file)
    let avatarUrl = doctor.avatar; // default: avatar lama

    if (req.file) {
      avatarUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;;
      console.log("Avatar BARU:", avatarUrl);
    } else {
      console.log("Tidak ada file yang dikirim → pakai avatar lama:", avatarUrl);
    }

    // Update
    await doctor.update({
      name,
      phone,
      specialization,
      bio,
      Study,
      isActive,
      avatar: avatarUrl,
    });

    console.log("=== UPDATE BERHASIL ===");

    res.json({ success: true, data: doctor });

  } catch (err) {
    console.log("=== ERROR UPDATE ===");
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Gagal update dokter",
      error: err.message,
    });
  }
});

router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findByPk(id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Dokter tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail dokter',
      error: err.message
    });
  }
});
// Delete doctor
router.delete('/:id', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const doctorId = req.params.id;

    const doctor = await Doctor.findByPk(doctorId, { transaction });
    if (!doctor) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Dokter tidak ditemukan' });
    }

    // =========================
    // 1️⃣ Hapus Booking dokter
    // =========================
    await Booking.destroy({
      where: { doctor_id: doctorId },
      transaction
    });

    // =========================
    // 2️⃣ Hapus BlockedTime
    // =========================
    await BlockedTime.destroy({
      where: { doctor_id: doctorId },
      transaction
    });

    // =========================
    // 3️⃣ Hapus Schedule
    // =========================
    await DoctorSchedule.destroy({
      where: { doctor_id: doctorId },
      transaction
    });

    // =========================
    // 4️⃣ Ambil service eksklusif dokter
    // =========================
    const doctorServices = await Service.findAll({
      where: {
        exclusive_doctor_id: doctorId,
        is_doctor_service: true
      },
      transaction
    });

    const serviceIds = doctorServices.map(s => s.id);

    // =========================
    // 5️⃣ Hapus pivot ServiceDoctor
    // =========================
    if (serviceIds.length > 0) {
      await ServiceDoctor.destroy({
        where: {
          doctor_id: doctorId
        },
        transaction
      });

      // =========================
      // 6️⃣ Hapus service eksklusif
      // =========================
      await Service.destroy({
        where: { id: serviceIds },
        transaction
      });
    }

    // =========================
    // 7️⃣ Hapus dokter
    // =========================
    await doctor.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Dokter dan seluruh data terkait berhasil dihapus'
    });

  } catch (err) {
    await transaction.rollback();
    console.error('DELETE DOCTOR ERROR:', err);

    res.status(500).json({
      message: 'Gagal hapus dokter',
      error: err.message
    });
  }
});


// ================= RECOVERY / RESET PASSWORD =================

// Send OTP
router.post('/send', async (req, res) => {
  try {
    const { email } = req.body;
    const doctor = await Doctor.findOne({ where: { email } });
    if (!doctor) return res.status(400).json({ message: 'Email belum terdaftar' });

    const otp = Math.floor(10000 + Math.random() * 90000);
    const otpexp = Date.now() + 5 * 60 * 1000;

    await sendEmail({
      to: email,
      subject: 'OTP RESET PASSWORD KLINIK DESI DUA',
      html: `<h1>OTP Anda: ${otp}</h1><p>Berlaku 5 menit</p>`
    });

    await Doctor.update({ otp, otpexp }, { where: { email } });
    res.json({ message: 'OTP sudah dikirim ke email', success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengirim OTP', error: err.message });
  }
});

// Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const doctor = await Doctor.findOne({ where: { email } });
    if (!doctor) return res.status(400).json({ message: 'Email tidak ditemukan' });

    if (String(doctor.otp) !== String(otp))
      return res.status(400).json({ message: 'OTP salah' });

    if (Date.now() > doctor.otpexp)
      return res.status(400).json({ message: 'OTP sudah expired' });

    await Doctor.update({ otp: null, otpexp: null }, { where: { email } });
    res.json({ success: true, message: 'OTP berhasil diverifikasi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal verifikasi OTP', error: err.message });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const doctor = await Doctor.findOne({ where: { email } });
    if (!doctor) return res.status(400).json({ message: 'Email tidak ditemukan' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await Doctor.update({ password: hash }, { where: { email } });
    res.json({ success: true, message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui password', error: err.message });
  }
});





module.exports = router;

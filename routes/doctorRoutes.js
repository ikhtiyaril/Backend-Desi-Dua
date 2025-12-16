const express = require('express');
const bcrypt = require('bcryptjs');
const { Doctor } = require('../models');
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
router.post('/' ,upload.single('avatar'), async (req, res) => {
  try {

    let { name, email, phone, specialization, bio, avatar, Study } = req.body;
if(req.file){
const fileUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;
    avatar = fileUrl
}else {
      console.log("Tidak ada file yang dikirim atau multer gagal menangkap file");
    }

    const exist = await Doctor.findOne({ where: { email } });
    if (exist) return res.status(400).json({ message: 'Email sudah terdaftar' });
    const password = '1234asdf'
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

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
    });

    res.json({ success: true, data: doctor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat dokter', error: err.message });
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
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
    res.json({ success: true, data: doctor });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil dokter', error: err.message });
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

// Delete doctor
router.delete('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

    await doctor.destroy();
    res.json({ success: true, message: 'Dokter berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal hapus dokter', error: err.message });
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

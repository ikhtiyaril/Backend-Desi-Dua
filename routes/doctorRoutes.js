const express = require('express');
const bcrypt = require('bcryptjs');
const { Doctor } = require('../models');
const sendEmail = require('../utils/sendmail');

const router = express.Router();

// ================= CRUD DOCTOR =================

// Create doctor
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, specialization, bio, avatar, Study } = req.body;

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
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, specialization, bio, avatar, Study, isActive } = req.body;
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

    await doctor.update({ name, phone, specialization, bio, avatar, Study, isActive });
    res.json({ success: true, data: doctor });
  } catch (err) {
    res.status(500).json({ message: 'Gagal update dokter', error: err.message });
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

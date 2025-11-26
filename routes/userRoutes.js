const bcrypt = require('bcryptjs');
const JWT = require('jsonwebtoken');
const express = require('express');
const route = express.Router();
const { User } = require('../models');
const sendEmail = require('../utils/sendmail')


route.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN] req.body:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('[LOGIN] Missing email or password');
      return res.status(400).json({ message: 'Email atau password kosong' });
    }

    const data = await User.findOne({ where: { email } });
    console.log('[LOGIN] Found user:', data);

    if (!data) {
      console.log('[LOGIN] Email not found');
      return res.status(400).json({ message: 'Email tidak ditemukan' });
    }

    const valid = await bcrypt.compare(password, data.password);
    console.log('[LOGIN] Password valid:', valid);

    if (!valid) {
      console.log('[LOGIN] Invalid password');
      return res.status(400).json({ message: 'Password salah' });
    }

    const payload = { name: data.name, email, role: data.role, id: data.id };
    const token = JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    console.log('[LOGIN] Login successful, token generated');

    return res.json({ token, message: 'Login berhasil' });
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    return res.status(500).json({ message: 'Login gagal', error: err.message });
  }
});

route.post('/login/admin', async (req, res) => {
  try {
    console.log('[ADMIN LOGIN] req.body:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('[ADMIN LOGIN] Missing email or password');
      return res.status(400).json({ message: 'Email atau password kosong' });
    }

    const data = await User.findOne({ where: { email } });
    console.log('[ADMIN LOGIN] Found user:', data);

    if (!data) {
      console.log('[ADMIN LOGIN] Email not found');
      return res.status(400).json({ message: 'Email tidak ditemukan' });
    }

    // cek role admin
    if (data.role !== 'admin') {
      console.log('[ADMIN LOGIN] Unauthorized role:', data.role);
      return res.status(403).json({ message: 'Anda tidak memiliki akses sebagai admin' });
    }

    const valid = await bcrypt.compare(password, data.password);
    console.log('[ADMIN LOGIN] Password valid:', valid);

    if (!valid) {
      console.log('[ADMIN LOGIN] Invalid password');
      return res.status(400).json({ message: 'Password salah' });
    }

    const payload = { 
      name: data.name, 
      email, 
      role: data.role 
    };

    const token = JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    console.log('[ADMIN LOGIN] Login successful, token generated');

    return res.json({ token, message: 'Login admin berhasil' });

  } catch (err) {
    console.error('[ADMIN LOGIN] Error:', err);
    return res.status(500).json({ message: 'Login admin gagal', error: err.message });
  }
});


route.post('/register', async (req, res) => {
  try {
    console.log('[REGISTER] req.body:', req.body);

    const { email, password, phone, name } = req.body;

    if (!email || !password || !phone || !name) {
      console.log('[REGISTER] Missing required fields');
      return res.status(400).json({ message: 'Email, password, nomor telepon, dan nama wajib diisi' });
    }

    const existingEmail = await User.findOne({ where: { email } });
    console.log('[REGISTER] existingEmail:', existingEmail);

    if (existingEmail) {
      console.log('[REGISTER] Email already used');
      return res.status(400).json({ message: 'Email sudah digunakan' });
    }

    const existingPhone = await User.findOne({ where: { phone } });
    console.log('[REGISTER] existingPhone:', existingPhone);

    if (existingPhone) {
      console.log('[REGISTER] Phone already used');
      return res.status(400).json({ message: 'Nomor telepon sudah digunakan' });
    }

    const salt = await bcrypt.genSalt(10);
    console.log('[REGISTER] Salt generated');

    const hash = await bcrypt.hash(password, salt);
    console.log('[REGISTER] Password hashed:', hash);

    const user = await User.create({ email, password: hash, name, phone, role: 'patient' });
    console.log('[REGISTER] User created:', user.toJSON());

    return res.json({ success: true, message: 'Register berhasil', user });
  } catch (err) {
    console.error('[REGISTER] Error:', err);
    return res.status(500).json({ message: 'Register gagal', error: err.message });
  }
});

route.post('/send',async(req,res)=>{
    try{
    const {email} = req.body
    const data = await User.findOne({where:{email}})
    if(!data)return res.status(400).json({message:'Email belum terdaftar'})

        const otp = Math.floor(10000+Math.random()*90000)
        const otpexp = Date.now() + 5 * 60 * 1000

        await sendEmail({
            to: email,
            subject: 'OTP RESET PASSWORD KLINIK DESI DUA',
            html:`
     <!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OTP Reset Password</title>
</head>

<body style="background-color:#f5f7fa; margin:0; padding:0; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 6px 20px rgba(0,0,0,0.05);">
          
          <tr>
            <td style="text-align:center;">
              <h2 style="margin:0; color:#1a1a1a;">OTP Reset Password</h2>
              <p style="margin:8px 0 24px; color:#555; font-size:14px;">
                Kode verifikasi untuk mereset password akun Anda.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 20px 0;">
              <div style="background:#f0f4ff; border-radius:8px; padding:20px;">
                <p style="font-size:14px; color:#444; margin:0;">Kode OTP Anda:</p>
                <h1 style="margin:10px 0 0; font-size:40px; letter-spacing:4px; color:#2a4dff;">
                  ${otp}
                </h1>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding-top:24px; color:#333; font-size:14px; line-height:1.6;">
              <p style="margin:0;">
                OTP ini hanya berlaku selama <strong>5 menit</strong>.  
                Jika Anda tidak merasa melakukan permintaan reset password, abaikan email ini.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-top:32px; text-align:center; font-size:13px; color:#aaa;">
              © Klinik Desi Dua — Sistem Digital Klinik
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>

</html>

    `
        })

await User.update({
    otp,
    otpexp
},{where:{email}})


res.json({message:'otp sudah bergasil dikirim ke email',success: true})

}catch(err){
    console.error('[OTP] Error:', err);
    return res.status(500).json({ message: 'OTP gagal', error: err.message });
}
}
)

route.post('/verifikasi', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: 'Email dan OTP wajib diisi' });

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(400).json({ message: 'Email tidak ditemukan' });

    // cek otp
    if (String(user.otp) !== String(otp))
      return res.status(400).json({ message: 'OTP salah' });

    // cek expired
    if (Date.now() > user.otpexp)
      return res.status(400).json({ message: 'OTP sudah expired' });

    await User.update(
      { otp: null, otpexp: null },
      { where: { email } }
    );

    return res.json({ success: true, message: 'OTP berhasil diverifikasi' });

  } catch (err) {
    console.error('[VERIFY OTP] Error:', err);
    return res.status(500).json({ message: 'Gagal verifikasi OTP', error: err.message });
  }
});

route.post('/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email dan password baru wajib diisi' });

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(400).json({ message: 'Email tidak ditemukan' });

    // hash password baru
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await User.update(
      { password: hash },
      { where: { email } }
    );

    return res.json({ success: true, message: 'Password berhasil diperbarui' });

  } catch (err) {
    console.error('[RESET PASSWORD] Error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui password', error: err.message });
  }
});


module.exports = route;

const bcrypt = require('bcryptjs');
const JWT = require('jsonwebtoken');
const express = require('express');
const route = express.Router();
const { User } = require('../models');
const sendEmail = require('../utils/sendmail')
const crypto = require('crypto');
const verifyToken = require("../middleware/verifyToken");
const upload = require("../middleware/cbUploads");



const MAX_ATTEMPT = 3;
const LOCK_TIME = 5 * 60 * 1000; // 5 menit

const VERIF_EXP_MS = 24 * 60 * 60 * 1000; // 24 jam
const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // contoh: 5 menit antara permintaan resend

function genTokenAndHash() {
  const token = crypto.randomBytes(32).toString('hex'); // 64 chars
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

route.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "role",
        "is_verified",
        "avatar",
        "createdAt",
        "updatedAt"
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }

    return res.json({
      success: true,
      data: user
    });

  } catch (err) {
    console.error("[GET /me] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data user"
    });
  }
});

route.put(
  "/me",
  verifyToken,
  upload.single("avatar"), // <-- ini yang nangkep file
  async (req, res) => {
    try {
      const { name, phone } = req.body;

      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User tidak ditemukan"
        });
      }

      // Update field biasa
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;

      // Kalau user upload avatar
      if (req.file) {
        user.avatar = `/uploads/${req.file.filename}`;
      }

      await user.save();

      return res.json({
        success: true,
        message: "Profil berhasil diperbarui",
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          is_verified: user.is_verified
        }
      });

    } catch (err) {
      console.error("[PUT /me] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Gagal memperbarui profil"
      });
    }
  }
);



route.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email atau password kosong' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: 'Email tidak ditemukan' });
    }

    // 🔒 CEK AKUN TERKUNCI
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const sisa = Math.ceil(
        (new Date(user.lock_until) - new Date()) / 60000
      );

      return res.status(403).json({
        message: `Akun dikunci. Coba lagi ${sisa} menit`,
        locked: true,
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    // ❌ PASSWORD SALAH
    if (!valid) {
      const attempt = user.failed_login_attempt + 1;

      // LOCK AKUN
      if (attempt >= MAX_ATTEMPT) {
        await user.update({
          failed_login_attempt: attempt,
          lock_until: new Date(Date.now() + LOCK_TIME),
        });

        return res.status(403).json({
          message: 'Terlalu banyak percobaan. Akun dikunci 5 menit',
          locked: true,
        });
      }

      await user.update({ failed_login_attempt: attempt });

      return res.status(400).json({
        message: `Password salah (${attempt}/${MAX_ATTEMPT})`,
      });
    }

    // ✅ LOGIN BERHASIL → RESET
    await user.update({
      failed_login_attempt: 0,
      lock_until: null,
    });

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };

    const token = JWT.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    return res.json({ token, message: 'Login berhasil' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Login gagal' });
  }
});


route.post('/login/admin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email atau password kosong' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: 'Email tidak ditemukan' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Bukan akun admin' });
    }

    // 🔒 CEK LOCK
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const sisa = Math.ceil(
        (new Date(user.lock_until) - new Date()) / 60000
      );

      return res.status(403).json({
        message: `Akun admin dikunci. Coba lagi ${sisa} menit`,
        locked: true,
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const attempt = user.failed_login_attempt + 1;

      if (attempt >= MAX_ATTEMPT) {
        await user.update({
          failed_login_attempt: attempt,
          lock_until: new Date(Date.now() + LOCK_TIME),
        });

        return res.status(403).json({
          message: 'Akun admin dikunci 5 menit',
          locked: true,
        });
      }

      await user.update({ failed_login_attempt: attempt });

      return res.status(400).json({
        message: `Password salah (${attempt}/${MAX_ATTEMPT})`,
      });
    }

    // RESET
    await user.update({
      failed_login_attempt: 0,
      lock_until: null,
    });

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = JWT.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    return res.json({ token, message: 'Login admin berhasil' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Login admin gagal' });
  }
});

route.post('/register', async (req, res) => {
  try {
    const { email, password, phone, name } = req.body;
    console.log('[DEBUG] Request Body:', req.body);

    if (!email || !password || !phone || !name) {
      console.log('[DEBUG] Missing field:', { email, password, phone, name });
      return res.status(400).json({ message: 'Email, password, nomor telepon, dan nama wajib diisi' });
    }

    const existingEmail = await User.findOne({ where: { email } });
    console.log('[DEBUG] existingEmail:', existingEmail ? true : false);
    if (existingEmail) return res.status(400).json({ message: 'Email sudah digunakan' });

    const existingPhone = await User.findOne({ where: { phone } });
    console.log('[DEBUG] existingPhone:', existingPhone ? true : false);
    if (existingPhone) return res.status(400).json({ message: 'Nomor telepon sudah digunakan' });

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    console.log('[DEBUG] Hashed password:', hashPassword);

    // buat token verifikasi
    const { token, hash } = genTokenAndHash();
    console.log('[DEBUG] Token & hash:', { token, hash });
    const verifyExp = new Date(Date.now() + VERIF_EXP_MS);
    console.log('[DEBUG] verifyExp:', verifyExp);

    // create user (is_verified false by default)
    const user = await User.create({
      email,
      password: hashPassword,
      name,
      phone,
      role: 'patient',
      is_verified: false,
      verify_token: hash,
      verify_token_exp: verifyExp
    });
    console.log('[DEBUG] User created:', user.id);

    // kirim email verifikasi (link berisi token mentah)
    const verifyLink = `${process.env.DOMAIN_FE_CLIENT || 'https://your-frontend.com'}verify-account?token=${token}&email=${encodeURIComponent(email)}`;
    console.log('[DEBUG] Verify link:', verifyLink);

    try {
      await sendEmail({
        to: email,
        subject: 'Verifikasi Email - Klinik',
        html: `
          <p>Halo ${name},</p>
          <p>Silakan klik link berikut untuk verifikasi email kamu (berlaku 24 jam):</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
          <p>Jika kamu tidak membuat akun, abaikan email ini.</p>
        `
      });
      console.log('[DEBUG] Email sent to:', email);
    } catch (emailErr) {
      console.error('[DEBUG] Email failed:', emailErr);
    }

    return res.json({ success: true, message: 'Akun dibuat. Cek email untuk verifikasi.' });

  } catch (err) {
    console.error('[REGISTER] Error:', err);
    return res.status(500).json({ message: 'Register gagal', error: err.message });
  }
});

// bisa GET atau POST. POST lebih aman (token di body).
route.post('/verify-email', async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ message: 'Email dan token diperlukan' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'User tidak ditemukan' });

    if (user.is_verified) return res.json({ success: true, message: 'Akun sudah terverifikasi' });

    // compare hashed token
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (!user.verify_token || user.verify_token !== hash) {
      return res.status(400).json({ message: 'Token verifikasi tidak valid' });
    }

    if (user.verify_token_exp && new Date() > new Date(user.verify_token_exp)) {
      return res.status(400).json({ message: 'Token verifikasi sudah kedaluwarsa' });
    }

    // tandai verified dan bersihkan token
    await user.update({ is_verified: true, verify_token: null, verify_token_exp: null });

    return res.json({ success: true, message: 'Email berhasil diverifikasi' });
  } catch (err) {
    console.error('[VERIFY EMAIL] Error:', err);
    return res.status(500).json({ message: 'Gagal verifikasi email', error: err.message });
  }
});

route.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email diperlukan' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'User tidak ditemukan' });
    if (user.is_verified) return res.status(400).json({ message: 'Akun sudah terverifikasi' });

    // optional: simple cooldown check using verify_token_exp (abuse workaround)
    if (user.verify_token_exp && new Date(user.verify_token_exp) - Date.now() > VERIF_EXP_MS - RESEND_COOLDOWN_MS) {
      // jika token baru saja dibuat, block resend sebentar
      return res.status(429).json({ message: 'Tunggu sebelum meminta verifikasi ulang (cooldown)' });
    }

    const { token, hash } = genTokenAndHash();
    const verifyExp = new Date(Date.now() + VERIF_EXP_MS);

    await user.update({ verify_token: hash, verify_token_exp: verifyExp });

    const verifyLink = `${process.env.FRONTEND_URL || 'https://your-frontend.com'}verify-account?token=${token}&email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: 'Resend Verifikasi Email - Klinik',
      html: `
        <p>Halo ${user.name},</p>
        <p>Silakan klik link berikut untuk verifikasi email kamu (berlaku 24 jam):</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
      `
    });

    return res.json({ success: true, message: 'Email verifikasi dikirim ulang' });
  } catch (err) {
    console.error('[RESEND VERIFY] Error:', err);
    return res.status(500).json({ message: 'Gagal mengirim ulang', error: err.message });
  }
});

route.get('/register/verify', async (req, res) => {
  try {
    const { token, email } = req.query; // ambil dari link query

    if (!token || !email) {
      return res.status(400).json({ message: 'Token dan email diperlukan' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'User tidak ditemukan' });

    if (user.is_verified) {
      return res.json({ success: true, message: 'Akun sudah terverifikasi' });
    }

    // hash token dari link agar bisa dicocokkan dengan database
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    if (!user.verify_token || user.verify_token !== hash) {
      return res.status(400).json({ message: 'Token verifikasi tidak valid' });
    }

    if (user.verify_token_exp && new Date() > new Date(user.verify_token_exp)) {
      return res.status(400).json({ message: 'Token verifikasi sudah kedaluwarsa' });
    }

    // tandai akun verified dan bersihkan token
    await user.update({
      is_verified: true,
      verify_token: null,
      verify_token_exp: null
    });

    return res.json({ success: true, message: 'Email berhasil diverifikasi' });

  } catch (err) {
    console.error('[VERIFY EMAIL LINK] Error:', err);
    return res.status(500).json({ message: 'Gagal verifikasi email', error: err.message });
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



r

module.exports = route;

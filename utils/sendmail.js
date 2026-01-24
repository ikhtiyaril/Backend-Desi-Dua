const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,          // smtp-relay.brevo.com
  port: process.env.SMTP_PORT,          // 587
  secure: false,                        // TLS
  auth: {
    user: process.env.SMTP_USER,       
    pass: process.env.SMTP_PASS,        // API KEY Brevo
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Klinik Desi Dua" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });

    console.log("📨 Email sent via Brevo!");
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
};

module.exports = sendEmail;

const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const sendEmail = async ({ to, subject, html }) => {
  try {
    const accessToken = await oauth2Client.getAccessToken();
    console.log("ACCES TOKEN CEKKKK")
console.log(accessToken)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_APP,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_APP,
      to,
      subject,
      html
    });

    console.log("Email sent!");
  } catch (err) {
    console.error("Email send error:", err);
    throw err;
  }
};

module.exports = sendEmail;

const jwt = require("jsonwebtoken");
const { Doctor } = require("../models");

module.exports = async function verifyDoctorToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const doctor = await Doctor.findByPk(decoded.id);
    if (!doctor) {
      return res.status(401).json({ message: "Doctor tidak ditemukan" });
    }

    req.user = {
      id: doctor.id,
      role: "doctor",
    };

    next();
  } catch (err) {
    console.error("[verifyDoctorToken]", err);
    return res.status(401).json({ message: "Token tidak valid" });
  }
};

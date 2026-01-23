const jwt = require("jsonwebtoken");
const { User, Doctor } = require("../models");

module.exports = async function verifyAuthFlexible(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let account = null;
    let role = decoded.role;

    // 1️⃣ Kalau role ada → langsung cek tabelnya
    if (role === "doctor") {
      account = await Doctor.findByPk(decoded.id);
    } else if (role === "user") {
      account = await User.findByPk(decoded.id);
    }

    // 2️⃣ Fallback (token lama / route bersama)
    if (!account) {
      account = await User.findByPk(decoded.id);
      role = account ? "user" : null;
    }

    if (!account) {
      account = await Doctor.findByPk(decoded.id);
      role = account ? "doctor" : null;
    }

    if (!account) {
      return res.status(401).json({ message: "Akun tidak ditemukan" });
    }

    // 3️⃣ Inject ke request
    req.user = {
      id: account.id,
      role,
      data: account, // kalau mau full object
    };

    next();
  } catch (err) {
    console.error("[verifyAuthFlexible]", err);
    return res.status(401).json({ message: "Token tidak valid" });
  }
};

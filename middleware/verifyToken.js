const jwt = require("jsonwebtoken");
const { User } = require("../models");

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ cek user di DB
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    req.user = user; // sekarang req.user benar-benar live dari DB
    next();
  } catch (err) {
    console.error("[verifyToken] Error:", err);
    return res.status(401).json({ message: "Token tidak valid" });
  }
};

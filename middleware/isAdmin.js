// middleware/isAdmin.js

module.exports = function isAdmin(req, res, next) {
  try {
    // Pastikan token sudah diverifikasi sebelumnya
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized: Token not provided or invalid"
      });
    }

    // Cek role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Forbidden: Admin access only"
      });
    }

    next(); // lanjut ke route berikutnya

  } catch (err) {
    return res.status(500).json({
      message: "Internal server error in admin middleware"
    });
  }
};

const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  
  const authHeader = req.headers.authorization;
console.log(authHeader)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ← data dari token masuk sini
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
};

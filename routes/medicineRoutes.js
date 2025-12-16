const express = require("express");
const router = express.Router();
const { Medicine, Category, PrescriptionAccess, User } = require("../models");
const { Op } = require("sequelize");
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");
const upload = require("../middleware/cbUploads");

router.get("/products", async (req, res) => {
  try {
    const { category, q } = req.query;
    const filters = {};
    if (category) filters.category_id = category;
    if (q) filters.name = { [Op.like]: `%${q}%` };

    const products = await Medicine.findAll({
      where: filters,
      include: [{ model: Category, as: "category" }],
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const product = await Medicine.findByPk(req.params.id, {
      include: [{ model: Category, as: "category" }],
    });

    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/products/:id/check-access", verifyToken, async (req, res) => {
  try {
    const product = await Medicine.findByPk(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    if (!product.is_prescription_required)
      return res.json({ allow: true, reason: "Obat tidak butuh resep." });

    const access = await PrescriptionAccess.findOne({
      where: {
        user_id: req.user.id,
        product_id: product.id,
        status: "approved",
      },
    });

    if (!access)
      return res.json({
        allow: false,
        reason: "Obat ini membutuhkan resep. Ajukan akses terlebih dahulu.",
      });

    res.json({ allow: true, reason: "Akses resep disetujui." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/admin/products", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    console.log("=== Mulai POST /admin/products ===");
    console.log("Headers:", req.headers);
    console.log("Body sebelum ditambah file URL:", req.body);
    console.log("File object (req.file):", req.file);

    if (req.file) {
      const fileUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;;
      req.body.image_url = fileUrl;
      console.log("File URL yang di-generate:", fileUrl, req.body.image_url);
    } else {
      console.log("Tidak ada file yang dikirim atau multer gagal menangkap file");
    }

    const product = await Medicine.create(req.body);
    console.log("Product berhasil dibuat:", product);

    res.json({ success: true, data: product });
  } catch (err) {
    console.error("Error di POST /admin/products:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


router.put("/admin/products/:id", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const product = await Medicine.findByPk(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    if (req.file) {
      const fileUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;;
      req.body.image_url = fileUrl;
    }

    await product.update(req.body);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/admin/products/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const product = await Medicine.findByPk(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    await product.destroy();
    res.json({ success: true, message: "Produk berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/admin/products/:id/unlock-user/:userId", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const product = await Medicine.findByPk(id);
    const user = await User.findByPk(userId);

    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    if (!user)
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    const access = await PrescriptionAccess.create({
      user_id: userId,
      product_id: id,
      status: "approved",
      notes: "Diapprove oleh admin",
    });

    res.json({ success: true, message: "Akses resep diberikan.", data: access });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

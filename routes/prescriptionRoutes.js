const express = require("express");
const router = express.Router();

const {
  PrescriptionRequest,
  UserProductAccess,
  Product,
  User
} = require("../models");

const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");


/* =====================================================
   USER ROUTES
   ===================================================== */

/**
 * POST /prescription/request/:productId
 * User mengajukan request akses obat resep
 */
router.post("/prescription/request/:productId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (!product.is_prescription_required) {
      return res.status(400).json({ message: "Obat ini tidak membutuhkan resep" });
    }

    // Cek apakah user sudah pernah request
    const existing = await PrescriptionRequest.findOne({
      where: {
        user_id: userId,
        product_id: productId,
        status: { [Op.in]: ["pending", "approved"] }
      }
    });

    if (existing) {
      return res.status(400).json({ message: "Anda sudah memiliki request aktif untuk obat ini" });
    }

    const requestAccess = await PrescriptionRequest.create({
      user_id: userId,
      product_id: productId,
      status: "pending"
    });

    return res.json({
      success: true,
      message: "Request resep berhasil dikirim",
      request: requestAccess
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * GET /prescription/my-requests
 * User melihat semua request resep miliknya
 */
router.get("/prescription/my-requests", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await PrescriptionRequest.findAll({
      where: { user_id: userId },
      include: [
        { model: Product, attributes: ["id", "name", "image_url"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({ success: true, requests });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/* =====================================================
   ADMIN ROUTES
   ===================================================== */

/**
 * PUT /admin/prescription/:id/approve
 * Admin menyetujui request akses obat resep
 * Jika approve → masukkan ke UserProductAccess
 */
router.put("/admin/prescription/:id/approve", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requestId = req.params.id;

    const request = await PrescriptionRequest.findOne({
      where: { id: requestId },
      include: [Product, User]
    });

    if (!request) return res.status(404).json({ message: "Request tidak ditemukan" });

    if (request.status === "approved") {
      return res.status(400).json({ message: "Request sudah disetujui sebelumnya" });
    }

    // Update status request
    request.status = "approved";
    await request.save();

    // Create UserProductAccess
    const access = await UserProductAccess.create({
      user_id: request.user_id,
      product_id: request.product_id,
      status: "approved"
    });

    return res.json({
      success: true,
      message: "Request disetujui. User diberi akses membeli obat.",
      access
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * PUT /admin/prescription/:id/reject
 * Admin menolak request resep
 */
router.put("/admin/prescription/:id/reject", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requestId = req.params.id;

    const request = await PrescriptionRequest.findByPk(requestId);
    if (!request) return res.status(404).json({ message: "Request tidak ditemukan" });

    request.status = "rejected";
    await request.save();

    return res.json({
      success: true,
      message: "Request resep ditolak"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/* =====================================================
   ACCESS CHECK HELPER (PUBLIC)
   ===================================================== */

/**
 * GET /prescription/access/check?productId=
 * Cek apakah user sudah punya akses beli obat resep
 */
router.get("/prescription/access/check", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.query.productId;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (!product.is_prescription_required) {
      return res.json({ access: true, message: "Obat ini bebas dibeli" });
    }

    const access = await UserProductAccess.findOne({
      where: {
        user_id: userId,
        product_id: productId,
        status: "approved"
      }
    });

    return res.json({
      access: !!access,
      message: access ? "Anda memiliki akses membeli obat ini" : "Anda belum memiliki akses"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;

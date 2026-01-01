const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");

const {
  PrescriptionAccess,
  Medicine,
  User,
  sequelize
} = require("../models");

const verifyToken = require("../middleware/verifyToken");
const upload = require("../middleware/cbUploads");

/* =====================================================
   USER ROUTES
   ===================================================== */

/**
 * POST /prescription/request/:medicineId
 * User request akses obat resep + upload foto resep
 */
router.post(
  "/request/:medicineId",
  verifyToken,
  upload.single("prescription"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const medicineId = req.params.medicineId;

      if (!req.file) {
        return res.status(400).json({
          message: "Foto resep wajib diunggah",
        });
      }

      const medicine = await Medicine.findByPk(medicineId);
      if (!medicine) {
        return res.status(404).json({ message: "Obat tidak ditemukan" });
      }

      if (!medicine.is_prescription_required) {
        return res.status(400).json({
          message: "Obat ini tidak membutuhkan resep",
        });
      }

      const existing = await PrescriptionAccess.findOne({
        where: {
          user_id: userId,
          product_id: medicineId,
          status: { [Op.in]: ["pending", "approved"] },
        },
      });

      if (existing) {
        return res.status(400).json({
          message: "Anda sudah memiliki request aktif untuk obat ini",
        });
      }

      // 🔥 URL BUKAN PATH
      const imageUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;

      const request = await PrescriptionAccess.create({
        user_id: userId,
        product_id: medicineId,
        prescription_image: imageUrl, // ✅ SIMPAN URL
        status: "pending",
      });

      return res.json({
        success: true,
        message: "Request resep berhasil dikirim",
        request,
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /admin/prescription/grant
 * Admin memberi akses manual obat resep
 */
router.post(
  "/admin/prescription/grant",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { user_id, product_id } = req.body;

      if (!user_id || !product_id) {
        return res.status(400).json({ message: "Data tidak lengkap" });
      }

      const medicine = await Medicine.findByPk(product_id);
      if (!medicine || !medicine.is_prescription_required) {
        return res
          .status(400)
          .json({ message: "Obat tidak membutuhkan resep" });
      }

      const existing = await PrescriptionAccess.findOne({
        where: {
          user_id,
          product_id,
          status: "approved",
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ message: "User sudah memiliki akses obat ini" });
      }

      const access = await PrescriptionAccess.create({
        user_id,
        product_id,
        status: "approved",
        prescription_image: null, // manual
      });

      return res.json({
        success: true,
        message: "Akses obat berhasil diberikan",
        access,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);


/**
 * DELETE /admin/prescription/:id
 * Admin mencabut akses obat resep
 */
router.delete(
  "/admin/prescription/:id",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const access = await PrescriptionAccess.findByPk(req.params.id);
      if (!access) {
        return res.status(404).json({ message: "Akses tidak ditemukan" });
      }

      await access.destroy();

      return res.json({
        success: true,
        message: "Akses obat berhasil dicabut",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /prescription/my-requests
 * User melihat semua request miliknya
 */
router.get("/prescription/my-requests", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await PrescriptionAccess.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Medicine,
          as: "product",
          attributes: ["id", "name", "image_url"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({ success: true, requests });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   ADMIN ROUTES
   ===================================================== */

/**
 * GET /admin/prescription/requests
 */
router.get("/admin/prescription/requests", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requests = await PrescriptionAccess.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        { model: Medicine, as: "product", attributes: ["id", "name"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({ success: true, requests });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /admin/prescription/:id/approve
 */
router.put("/admin/prescription/:id/approve", verifyToken, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    if (req.user.role !== "admin") {
      await t.rollback();
      return res.status(403).json({ message: "Forbidden" });
    }

    const request = await PrescriptionAccess.findByPk(req.params.id, {
      transaction: t
    });

    if (!request || request.status !== "pending") {
      await t.rollback();
      return res.status(400).json({ message: "Request tidak valid" });
    }

    request.status = "approved";
    await request.save({ transaction: t });

    await t.commit();

    return res.json({
      success: true,
      message: "Request disetujui, user boleh membeli obat"
    });

  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /admin/prescription/:id/reject
 */
router.put("/admin/prescription/:id/reject", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const request = await PrescriptionAccess.findByPk(req.params.id);
    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Request tidak valid" });
    }

    request.status = "rejected";
    await request.save();

    return res.json({
      success: true,
      message: "Request resep ditolak"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   ACCESS CHECK (CHECKOUT)
   ===================================================== */

/**
 * GET /prescription/access/check?productId=
 */
router.get("/access/check", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.query;

    const medicine = await Medicine.findByPk(productId);
    if (!medicine) {
      return res.status(404).json({ message: "Obat tidak ditemukan" });
    }

    if (!medicine.is_prescription_required) {
      return res.json({ access: true });
    }

    const approved = await PrescriptionAccess.findOne({
      where: {
        user_id: userId,
        product_id: productId,
        status: "approved"
      }
    });

    return res.json({ access: !!approved });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

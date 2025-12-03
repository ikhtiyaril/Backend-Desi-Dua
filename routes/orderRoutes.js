const express = require("express");
const router = express.Router();
const {
  Order,
  OrderItem,
  Medicine,
  User
} = require("../models");
const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");

/* =====================================================
   USER ROUTES
   ===================================================== */

/**
 * GET /orders
 * Ambil semua order user
 */
router.get("/orders", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          include: [
            { model: Medicine, as: "product" }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * GET /orders/:id
 * Detail order user
 */
router.get("/orders/:id", verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: {
        id: orderId,
        user_id: userId
      },
      include: [
        {
          model: OrderItem,
          include: [
            { model: Medicine, as: "product" }
          ]
        }
      ]
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * POST /orders/:id/cancel
 */
router.post("/orders/:id/cancel", verifyToken, async (req, res) => {
  const t = await Order.sequelize.transaction();

  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: {
        id: orderId,
        user_id: userId,
        status: { [Op.notIn]: ["cancelled", "completed"] }
      },
      include: [
        {
          model: OrderItem,
          include: [{ model: Medicine, as: "product" }]
        }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Order not found or cannot be cancelled" });
    }

    // restore stok
    for (const item of order.OrderItems) {
      await Medicine.increment(
        { stock: item.quantity },
        { where: { id: item.product_id }, transaction: t }
      );
    }

    order.status = "cancelled";
    await order.save({ transaction: t });

    await t.commit();
    return res.json({ success: true, message: "Order cancelled" });

  } catch (err) {
    console.error(err);
    await t.rollback();
    return res.status(500).json({ message: "Server error" });
  }
});


/* =====================================================
   ADMIN ROUTES
   ===================================================== */

/**
 * GET /admin/orders
 */
router.get("/admin/orders", verifyToken, async (req, res) => {
  console.log("🔥 GET /admin/orders");

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

   const orders = await Order.findAll({
  include: [
    {
      model: OrderItem,
      as: "items",
      include: [
        { model: Medicine, as: "product" }
      ]
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name", "email", "phone"]
    }
  ],
  order: [["createdAt", "DESC"]]
});

    return res.json({ success: true, orders });

  } catch (err) {
    console.error("❌ ERROR /admin/orders:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * PUT /admin/orders/:id/status
 */
router.put("/admin/orders/:id/status", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const orderId = req.params.id;
    const { status } = req.body;

    const validStatus = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "completed",
      "cancelled"
    ];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();

    return res.json({ success: true, message: "Order status updated", order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

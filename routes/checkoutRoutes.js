const express = require("express");
const router = express.Router();
const { Product ,Cart, CartItem, Medicine, Order, OrderItem, PrescriptionAccess } = require("../models");
const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");

/**
 * ===========================
 * 1. POST /checkout/validate
 * ===========================
 * Cek:
 * - stok
 * - harga terbaru
 * - akses resep (PrescriptionAccess)
 */
router.post("/validate", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("🟦 [DEBUG] Validate Checkout - User:", userId);

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            {
              model: Medicine,
              as: "product"
            }
          ]
        }
      ]
    });

    console.log("🟩 [DEBUG] Cart Found:", !!cart);

    if (!cart) return res.status(404).json({ message: "Cart not found." });

    const errors = [];
    const items = cart.items;

    console.log("📦 [DEBUG] Total Items in Cart:", items.length);

    for (const item of items) {
      const product = item.product;

      console.log(`\n🔍 [DEBUG] Checking Medicine ID: ${product?.id}`);
      console.log("📝 Name:", product?.name);
      console.log("📦 Stock:", product?.stock);
      console.log("🛒 Quantity:", item.quantity);

      // 1. Cek stok
      if (product.stock < item.quantity) {
        errors.push({
          product_id: product.id,
          message: `Stok untuk ${product.name} tidak mencukupi`
        });
      }

      // 2. Cek akses resep
      if (product.is_prescription_required) {
        const access = await PrescriptionAccess.findOne({
          where: {
            user_id: userId,
            product_id: product.id,
            status: "approved"
          }
        });

        if (!access) {
          errors.push({
            product_id: product.id,
            message: `${product.name} membutuhkan akses resep`
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    return res.json({ success: true, message: "Checkout valid." });

  } catch (err) {
    console.error("💥 [DEBUG] Server Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});




/**
 * =====================
 * 2. POST /checkout
 * =====================
 * Proses:
 * - validate ulang
 * - create order
 * - create orderItem
 * - update stok
 * - clear cart
 */
router.post("/", verifyToken, async (req, res) => {
  const t = await Cart.sequelize.transaction();

  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            { model: Medicine, as: "product" }
          ]
        }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!cart) {
      await t.rollback();
      return res.status(404).json({ message: "Cart not found." });
    }

    const items = cart.items;
    let totalPrice = 0;

    // VALIDATION
    for (const item of items) {
      const med = item.product;

      if (med.stock < item.quantity) {
        await t.rollback();
        return res.status(400).json({
          message: `Stok tidak cukup untuk ${med.name}`
        });
      }

      if (med.is_prescription_required) {
        const access = await PrescriptionAccess.findOne({
          where: {
            user_id: userId,
            product_id: med.id,
            status: "approved"
          },
          transaction: t
        });

        if (!access) {
          await t.rollback();
          return res.status(403).json({
            message: `${med.name} membutuhkan akses resep.`
          });
        }
      }

      totalPrice += med.price * item.quantity;
    }

    // CREATE ORDER
    const order = await Order.create(
      {
        user_id: userId,
        total_price: totalPrice,
        status: "pending",
        payment_method: req.body.payment_method || "manual"
      },
      { transaction: t }
    );

    // CREATE ORDER ITEMS
    for (const item of items) {
      const med = item.product;

      await OrderItem.create(
        {
          order_id: order.id,
          product_id: med.id,
          quantity: item.quantity,
          price: med.price
        },
        { transaction: t }
      );

      // UPDATE STOCK
      await Medicine.update(
        { stock: med.stock - item.quantity },
        {
          where: { id: med.id },
          transaction: t
        }
      );
    }

    // CLEAR CART
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction: t
    });

    await t.commit();
    return res.json({ success: true, message: "Order created", order });

  } catch (err) {
    console.error(err);
    await t.rollback();
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
